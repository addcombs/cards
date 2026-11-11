// Generated from project.json and config\cognito-pool.json by Sync-UiConfig in scripts\common.ps1,
// which start-all runs before building. Edit those files, not this one.
export const PROJECT_SETTINGS = {
  appName: 'cards',
  displayName: 'Combs\' Corner Cards',
  developerName: 'Adam Combs',
  apiUrl: 'https://api.cards.acombs-dev.com',
  photosUrl: 'https://cards.acombs-dev.com/images/photos/',
  auth: {
    userPoolId: 'us-east-2_tbL7X0zuE',
    userPoolClientId: '4fmkh15shot64a3r6r174mjcr9',
    domain: 'cards-acombs.auth.us-east-2.amazoncognito.com',
    redirectSignIn: ['http://localhost:4200/', 'https://cards.acombs-dev.com/'],
    redirectSignOut: ['http://localhost:4200/', 'https://cards.acombs-dev.com/'],
  },
};
