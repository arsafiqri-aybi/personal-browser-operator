import path from 'node:path';
import crypto from 'node:crypto';
import { chromium, type BrowserContext, type Locator, type Page } from 'playwright';
import { markUntrustedObservation } from './firewall.js';
import { assertPublicHttpUrl } from './network-guard.js';
import type { BrowserObservation, ElementRef } from './types.js';

type RefDescriptor = ElementRef & { cssPath: string };

interface Session {
  identityId: string;
  context: BrowserContext;
  page: Page;
  stateCounter: number;
  refs: Map<string, RefDescriptor>;
  stateVersion: string | null;
  allowedDomains: string[];
  navigationPolicyViolation: string | null;
}

function safeIdentityId(value: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) throw new Error('INVALID_IDENTITY_ID');
  return value;
}

export class BrowserManager {
  private sessions = new Map<string, Session>();

  async open(identityIdRaw: string): Promise<{ identityId: string; pages: number; url: string }> {
    const identityId = safeIdentityId(identityIdRaw);
    const existing = this.sessions.get(identityId);
    if (existing) {
      return { identityId, pages: existing.context.pages().length, url: existing.page.url() };
    }

    const dataRoot = process.env.PBO_DATA_DIR || path.resolve('runtime-data');
    const userDataDir = path.join(dataRoot, 'profiles', identityId);
    const headless = process.env.PBO_HEADLESS !== 'false';

    const context = await chromium.launchPersistentContext(userDataDir, {
      headless,
      viewport: { width: 1440, height: 960 }
    });

    await context.route('**/*', async route => {
      const request = route.request();
      const rawUrl = request.url();

      try {
        const parsed = new URL(rawUrl);
        if (!['http:', 'https:'].includes(parsed.protocol)) {
          await route.continue();
          return;
        }

        if (process.env.PBO_ALLOW_PRIVATE_NETWORKS !== 'true') {
          await assertPublicHttpUrl(rawUrl);
        }

        const session = this.sessions.get(identityId);
        if (session && session.allowedDomains.length > 0 && request.isNavigationRequest()) {
          const frame = request.frame();
          const isTopLevel = frame === frame.page().mainFrame();
          if (isTopLevel) {
            const host = parsed.hostname.toLowerCase().replace(/\.$/, '');
            const allowed = session.allowedDomains.some(
              domain => host === domain || host.endsWith('.' + domain)
            );
            if (!allowed) {
              session.navigationPolicyViolation = `POLICY_DENIED_DOMAIN_NOT_ALLOWED_BY_TASK:${host}`;
              await route.abort('blockedbyclient');
              return;
            }
          }
        }

        await route.continue();
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        const session = this.sessions.get(identityId);
        if (message === 'PRIVATE_NETWORK_NAVIGATION_DENIED') {
          if (session) session.navigationPolicyViolation = message;
          await route.abort('blockedbyclient');
          return;
        }
        await route.abort('failed');
      }
    });

    const page = context.pages()[0] ?? await context.newPage();
    this.sessions.set(identityId, {
      identityId,
      context,
      page,
      stateCounter: 0,
      refs: new Map(),
      stateVersion: null,
      allowedDomains: [],
      navigationPolicyViolation: null
    });

    return { identityId, pages: context.pages().length, url: page.url() };
  }

  session(identityIdRaw: string): Session {
    const identityId = safeIdentityId(identityIdRaw);
    const session = this.sessions.get(identityId);
    if (!session) throw new Error(`SESSION_NOT_OPEN:${identityId}`);
    return session;
  }

  setAllowedDomains(identityId: string, domains: string[]): void {
    const session = this.session(identityId);
    session.allowedDomains = [...new Set(domains.map(domain => domain.trim().toLowerCase().replace(/\.$/, '')).filter(Boolean))];
    session.navigationPolicyViolation = null;
  }

  private invalidateObservedState(session: Session): void {
    session.stateVersion = null;
    session.refs.clear();
  }

  private async restoreAfterBlockedNavigation(session: Session, safeUrl: string): Promise<void> {
    session.navigationPolicyViolation = null;
    if (!/^https?:\/\//i.test(safeUrl)) return;
    if (session.page.url() === safeUrl) return;

    try {
      await session.page.goto(safeUrl, { waitUntil: 'domcontentloaded' });
    } catch {
      // Best-effort continuity recovery. The original policy violation remains authoritative.
    }
  }

  async navigate(identityId: string, rawUrl: string): Promise<{ url: string; title: string }> {
    const session = this.session(identityId);
    const url = process.env.PBO_ALLOW_PRIVATE_NETWORKS === 'true'
      ? new URL(rawUrl)
      : await assertPublicHttpUrl(rawUrl);

    const safeUrl = session.page.url();
    session.navigationPolicyViolation = null;
    try {
      await session.page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    } catch (error) {
      const policyViolation = session.navigationPolicyViolation;
      if (policyViolation) {
        await this.restoreAfterBlockedNavigation(session, safeUrl);
        this.invalidateObservedState(session);
        throw new Error(policyViolation);
      }
      this.invalidateObservedState(session);
      throw error;
    }

    const policyViolation = session.navigationPolicyViolation;
    if (policyViolation) await this.restoreAfterBlockedNavigation(session, safeUrl);
    this.invalidateObservedState(session);
    if (policyViolation) throw new Error(policyViolation);
    return { url: session.page.url(), title: await session.page.title() };
  }

  async observe(identityId: string): Promise<BrowserObservation> {
    const session = this.session(identityId);
    const page = session.page;

    const ariaSnapshot = await page.ariaSnapshot().catch(() => '');
    const rawElements = await page.locator(
      'a[href],button,input,textarea,select,[role="button"],[role="link"],[role="textbox"],[role="checkbox"],[role="radio"],[contenteditable="true"]'
    ).evaluateAll((elements) => {
      return elements.slice(0, 250).flatMap((el) => {
        const html = el as HTMLElement;
        const style = getComputedStyle(html);
        const rect = html.getBoundingClientRect();
        if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return [];

        let cssPathValue = '';
        if (el.id) {
          cssPathValue = '#' + CSS.escape(el.id);
        } else {
          const parts: string[] = [];
          let current: Element | null = el;
          while (current && current !== document.documentElement) {
            let part = current.tagName.toLowerCase();
            const currentTag = current.tagName;
            const parent: Element | null = current.parentElement;
            if (parent) {
              const siblings: Element[] = Array.from(parent.children).filter(
                (x: Element) => x.tagName === currentTag
              );
              if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
            }
            parts.unshift(part);
            current = parent;
            if (parts.length >= 6) break;
          }
          cssPathValue = parts.join(' > ');
        }

        const tag = el.tagName.toLowerCase();
        const explicitRole = el.getAttribute('role');
        let role = explicitRole || tag;
        if (!explicitRole) {
          if (el.getAttribute('contenteditable') === 'true') role = 'textbox';
          else if (tag === 'a') role = 'link';
          else if (tag === 'button') role = 'button';
          else if (tag === 'textarea') role = 'textbox';
          else if (tag === 'select') role = 'combobox';
          else if (tag === 'input') {
            const t = (el.getAttribute('type') || 'text').toLowerCase();
            role = t === 'checkbox' ? 'checkbox' : t === 'radio' ? 'radio' : t === 'submit' || t === 'button' ? 'button' : 'textbox';
          }
        }

        const ariaLabel = el.getAttribute('aria-label') || '';
        const placeholder = el.getAttribute('placeholder');
        const title = el.getAttribute('title') || '';
        const text = (html.innerText || el.getAttribute('value') || '').trim().replace(/\s+/g, ' ').slice(0, 240);
        const name = (ariaLabel || text || placeholder || title || '').slice(0, 240);

        return [{
          role,
          name,
          tag,
          placeholder,
          type: el.getAttribute('type'),
          cssPath: cssPathValue
        }];
      });
    });

    session.stateCounter += 1;
    const stateVersion = `${identityId}:${session.stateCounter}`;
    session.stateVersion = stateVersion;
    session.refs.clear();

    const interactiveElements: ElementRef[] = rawElements.map((item, index) => {
      const ref = `ref-${index + 1}`;
      session.refs.set(ref, { ref, ...item });
      return {
        ref,
        role: item.role,
        name: item.name,
        tag: item.tag,
        placeholder: item.placeholder,
        type: item.type
      };
    });

    return markUntrustedObservation({
      observationId: `OBS-${crypto.randomUUID()}`,
      identityId,
      stateVersion,
      url: page.url(),
      title: await page.title(),
      ariaSnapshot,
      interactiveElements,
      capturedAt: new Date().toISOString()
    });
  }

  private async resolve(identityId: string, stateVersion: string, ref: string): Promise<Locator> {
    const session = this.session(identityId);
    if (!session.stateVersion || session.stateVersion !== stateVersion) throw new Error('STALE_STATE');
    const descriptor = session.refs.get(ref);
    if (!descriptor) throw new Error('TARGET_NOT_FOUND');

    if (descriptor.role && descriptor.name) {
      try {
        const candidate = session.page.getByRole(descriptor.role as any, { name: descriptor.name, exact: true });
        if (await candidate.count() === 1) return candidate;
      } catch {
        // Fall back to the exact observed DOM path.
      }
    }

    if (descriptor.placeholder) {
      const candidate = session.page.getByPlaceholder(descriptor.placeholder, { exact: true });
      if (await candidate.count() === 1) return candidate;
    }

    if (descriptor.name) {
      const candidate = session.page.getByText(descriptor.name, { exact: true });
      if (await candidate.count() === 1) return candidate;
    }

    const fallback = session.page.locator(descriptor.cssPath);
    if (await fallback.count() !== 1) throw new Error('AMBIGUOUS_OR_STALE_TARGET');
    return fallback;
  }

  async interact(
    identityId: string,
    stateVersion: string,
    ref: string,
    operation: 'click' | 'fill' | 'press' | 'select' | 'hover',
    value?: string
  ): Promise<{ operation: string; targetRef: string; needsReobserve: true }> {
    const session = this.session(identityId);
    const locator = await this.resolve(identityId, stateVersion, ref);
    const safeUrl = session.page.url();
    session.navigationPolicyViolation = null;

    switch (operation) {
      case 'click':
        await locator.click();
        break;
      case 'fill':
        if (value === undefined) throw new Error('VALUE_REQUIRED');
        await locator.fill(value);
        break;
      case 'press':
        if (value === undefined) throw new Error('VALUE_REQUIRED');
        await locator.press(value);
        break;
      case 'select':
        if (value === undefined) throw new Error('VALUE_REQUIRED');
        await locator.selectOption(value);
        break;
      case 'hover':
        await locator.hover();
        break;
    }

    const policyViolation = session.navigationPolicyViolation;
    if (policyViolation) await this.restoreAfterBlockedNavigation(session, safeUrl);
    this.invalidateObservedState(session);
    if (policyViolation) throw new Error(policyViolation);
    return { operation, targetRef: ref, needsReobserve: true };
  }

  async close(identityId: string): Promise<void> {
    const session = this.session(identityId);
    this.sessions.delete(session.identityId);
    await session.context.close();
  }
}
