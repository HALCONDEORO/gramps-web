import {LitElement, html, css} from 'lit'
import {GrampsjsAppStateMixin} from '../mixins/GrampsjsAppStateMixin.js'
import {dateContradictions} from '../charts/dateContradictions.js'
import {loadDateContext} from '../charts/loadDateContext.js'

const messages = {
  burialBeforeBaptism: 'Burial is dated before baptism.',
  childBeforeParent: 'A biological child is dated before a parent was born.',
  marriageBeforeDivorce: 'A marriage is dated before another recorded divorce.',
}

export class GrampsjsDateAlerts extends GrampsjsAppStateMixin(LitElement) {
  static get properties() {
    return {
      person: {type: Object},
      _alerts: {state: true},
      _loading: {state: true},
      _incomplete: {state: true},
    }
  }

  static get styles() {
    return css`
      :host {
        display: block;
        margin-block: 16px;
      }
      section {
        border: 1px solid var(--md-sys-color-outline, #777);
        border-radius: 10px;
        padding: 16px;
      }
      h3 {
        margin: 0 0 8px;
        font-size: 1rem;
      }
      p {
        margin: 8px 0;
        line-height: 1.5;
      }
      ul {
        padding-left: 20px;
      }
      li {
        margin-block: 12px;
        line-height: 1.5;
      }
      a {
        color: var(--md-sys-color-primary, #315da8);
        display: inline-block;
        margin: 4px 10px 0 0;
        overflow-wrap: anywhere;
      }
      .scope {
        font-size: 0.85rem;
      }
    `
  }

  constructor() {
    super()
    this.person = null
    this._alerts = []
    this._loading = false
    this._incomplete = false
    this._request = 0
  }

  updated(changed) {
    const permissions = JSON.stringify(this.appState?.permissions ?? {})
    if (
      changed.has('person') ||
      permissions !== this._permissions ||
      this.appState?.apiGet !== this._apiGet
    ) {
      this._permissions = permissions
      this._apiGet = this.appState?.apiGet
      this._load()
    }
  }

  async _load() {
    const request = ++this._request
    const person = this.person
    this._alerts = []
    this._incomplete = false
    if (!person?.handle || typeof this._apiGet !== 'function') {
      this._loading = false
      return
    }
    this._loading = true
    const current = () => request === this._request && this.isConnected
    const context = await loadDateContext(
      person,
      url => this._apiGet(url),
      current
    )
    if (!current()) return
    this._alerts = dateContradictions(person, context.people, context.families)
    this._incomplete = context.incomplete
    this._loading = false
  }

  connectedCallback() {
    super.connectedCallback()
    if (this.hasUpdated) this._load()
  }

  disconnectedCallback() {
    this._request += 1
    this._alerts = []
    super.disconnectedCallback()
  }

  render() {
    if (!this.person?.handle) return html``
    return html`<section aria-label=${this._('Date checks')}>
      <h3>${this._('Possible date contradictions')}</h3>
      ${this._loading
        ? html`<p role="status">${this._('Checking available dates…')}</p>`
        : this._alerts.length
        ? html`<ul>
            ${this._alerts.map(
              alert => html`<li>
                ${this._(messages[alert.code])}
                <div>
                  ${alert.refs
                    .filter(ref => ref.id)
                    .map(
                      ref =>
                        html`<a
                          href=${`${ref.kind}/${encodeURIComponent(ref.id)}`}
                          >${ref.id}</a
                        >`
                    )}
                </div>
              </li>`
            )}
          </ul>`
        : html`<p>
            ${this._(
              'No contradiction found in the assessed dates. This is not a complete validation.'
            )}
          </p>`}
      ${this._incomplete
        ? html`<p role="status">
            ${this._('Some related records could not be checked.')}
          </p>`
        : ''}
      <p class="scope">
        ${this._(
          'Review the linked sources before changing anything. Only unqualified Gregorian dates are assessed; partial dates must not overlap. Two weddings alone do not prove simultaneous spouses.'
        )}
      </p>
    </section>`
  }
}
window.customElements.define('grampsjs-date-alerts', GrampsjsDateAlerts)
