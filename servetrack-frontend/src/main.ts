import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { environment } from './environments/environment';

bootstrapApplication(App, appConfig);

// Self-XSS console warning (production only)
if (environment.production) {
  const stopStyle = 'color: red; font-size: 48px; font-weight: bold; text-shadow: 2px 2px 0 rgba(0,0,0,0.3);';
  const warningStyle = 'color: #e5e7eb; font-size: 16px; line-height: 1.6;';
  const linkStyle = 'color: #60a5fa; font-size: 14px;';

  console.log('%cStop!', stopStyle);
  console.log(
    '%cThis is a browser feature intended for developers.\n' +
    'If someone told you to copy-paste something here to\n' +
    'enable a ServeTrack feature or access someone\'s\n' +
    'account, it\'s a scam and will give them access to\n' +
    'your account.',
    warningStyle
  );
  console.log(
    '%cLearn more: https://en.wikipedia.org/wiki/Self-XSS',
    linkStyle
  );
}
