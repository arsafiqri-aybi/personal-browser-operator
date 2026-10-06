import path from 'node:path';
import crypto from 'node:crypto';
import { chromium, type BrowserContext, type Locator, type Page } from 'playwright';
import { markUntrustedObservation } from './firewall.js';
import type { BrowserObservation, ElementRef } from './types.js';

type RefDescriptor = ElementRef & { cssPath: string };

interface Session {
  identityId: string;
  context: BrowserContext;
  page: Page;
  stateCounter: number;
  refs: Map<string, RefDescriptor>;
  stateVersion: string | null;
}

function safeIdentityId(value: string): string {
  if (!/^[A-Za-z0-9._-]+$/.test(value)) throw new Error('INVALID_IDENTITY_ID');
  return value;
}

function isPrivateIPv4(host: string): boolean {
  const parts = host.split('.').map(Number);
  if (parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255)) return false;
  if (parts[0] === 10 || parts[0] === 127) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] !== undefined && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 169 && parts[1] === 254) return true;
  return false;
}

function assertSafeUrl(raw: string): URL {
  const url = new URL(raw);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('UNSUPPORTED_URL_PROTOCOL');
  const host = url.hostname.toLowerCase();
  const allowPrivate = process.env.PBO_ALLOW_PRIVATE_NETWORKS === 'true';
  if (!allowPrivate && (host === 'localhost' || host === '::1' || host.endsWith('.local') || isPrivateIPv4(host))) {
    throw new Error('PRIVATE_NETWORK_NAVIGATION_DENIED');
  }
  return url;
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

    const page = context.pages()[0] ?? await context.newPage();
    this.sessions.set(identityId, {
      identityId,
      context,
      page,
      stateCounter: 0,
      refs: new Map(),
      stateVersion: null
    });

    return { identityId, pages: context.pages().length, url: page.url() };
  }

  session(identityIdRaw: string): Session {
    const identityId = safeIdentityId(identityIdRaw);
    const session = this.sessions.get(identityId);
    if (!session) throw new Error(`SESSION_NOT_OPEN:${identityId}`);
    return session;
  }

  private invalidateObservedState(session: Session): void {
    session.stateVersion = null;
    session.refs.clear();
  }

  async navigate(identityId: string, rawUrl: string): Promise<{ url: string; title: string }> {
    const session = this.session(identityId);
    const url = assertSafeUrl(rawUrl);
    await session.page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    this.invalidateObservedState(session);
    return { url: session.page.url(), title: await session.page.title() };
  }

  async observe(identityId: string): Promise<BrowserObservation> {
    const session = this.session(identityId);
    const page = session.page;

    const ariaSnapshot = await page.ariaSnapshot().catch(() => '');
    const rawElements = await page.locator(
      'a[href],button,input,textarea,select,[role="button"],[role="link"],[role="textbox"],[role="checkbox"],[role="radio"],[contenteditable="true"]'
    ).evaluateAll((elements) => {
      function cssPath(el: Element): string {
        if (el.id) return '#' + CSS.escape(el.id);
        const parts: string[] = [];
        let current: Element | null = el;
        while (current && current !== document.documentElement) {
          let part = current.tagName.toLowerCase();
          const parent = current.parentElement;
          if (parent) {
            const siblings = Array.from(parent.children).filter(x => x.tagName === current!.tagName);
            if (siblings.length > 1) part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
          }
          parts.unshift(part);
          current = parent;
          if (parts.length >= 6) break;
        }
        return parts.join(' > ');
      }

      return elements.slice(0, 250).flatMap((el) => {
        const html = el as HTMLElement;
        const style = getComputedStyle(html);
        const rect = html.getBoundingClientRect();
        if (style.display === 'none' || style.visibility === 'hidden' || rect.width === 0 || rect.height === 0) return [];

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
          cssPath: cssPath(el)
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

    this.invalidateObservedState(session);
    return { operation, targetRef: ref, needsReobserve: true };
  }

  async close(identityId: string): Promise<void> {
    const session = this.session(identityId);
    this.sessions.delete(session.identityId);
    await session.context.close();
  }
}
