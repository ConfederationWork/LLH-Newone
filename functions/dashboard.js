/* 
DASHBOARD EXAMPLE

  Install the following for dashboard stuff.
  npm install body-parser ejs express express-passport express-session marked passport passport-discord
  
This is a very simple dashboard example, but even in its simple state, there are still a
lot of moving parts working together to make this a reality. I shall attempt to explain
those parts in as much details as possible, but be aware: there's still a lot of complexity
and you shouldn't expect to really understand all of it instantly.

Pay attention, be aware of the details, and read the comments. 

Note that this *could* be split into multiple files, but for the purpose of this
example, putting it in one file is a little simpler. Just *a little*.
*/

// Native Node Imports
const url = require('url');
const path = require('path');

// Used for Permission Resolving...
const Discord = require('discord.js');

// Express Session
const express = require('express');
const app = express();
const moment = require('moment');
require('moment-duration-format');

// Express Plugins
// Specifically, passport helps with oauth2 in general.
// passport-discord is a plugin for passport that handles Discord's specific implementation.
const passport = require('passport');
const session = require('express-session');
const LevelStore = require('level-session-store')(session);
const Strategy = require('passport-discord').Strategy;

// Helmet is specifically a security plugin that enables some specific, useful 
// headers in your page to enhance security.
const helmet = require('helmet');

// Used to parse Markdown from things like ExtendedHelp
const md = require('marked');

module.exports = (client) => {
  // It's easier to deal with complex paths. 
  // This resolves to: yourbotdir/dashboard/
  const dataDir = path.resolve(`${process.cwd()}${path.sep}assets${path.sep}dashboard`);

  // This resolves to: yourbotdir/dashboard/templates/ 
  // which is the folder that stores all the internal template files.
  const templateDir = path.resolve(`${dataDir}${path.sep}templates`);

  // The public data directory, which is accessible from the *browser*. 
  // It contains all css, client javascript, and images needed for the site.
  app.use('/public', express.static(path.resolve(`${dataDir}${path.sep}public`)));

  // uhhhh check what these do. 
  passport.serializeUser((user, done) => {
    done(null, user);
  });
  passport.deserializeUser((obj, done) => {
    done(null, obj);
  });

  /* 
  This defines the **Passport** oauth2 data. A few things are necessary here.
  
  clientID = Your bot's client ID, at the top of your app page. Please note, 
    older bots have BOTH a client ID and a Bot ID. Use the Client one.
  clientSecret: The secret code at the top of the app page that you have to 
    click to reveal. Yes that one we told you you'd never use.
  callbackURL: The URL that will be called after the login. This URL must be
    available from your PC for now, but must be available publically if you're
    ever to use this dashboard in an actual bot. 
  scope: The data scopes we need for data. identify and guilds are sufficient
    for most purposes. You might have to add more if you want access to more
    stuff from the user. See: https://discordapp.com/developers/docs/topics/oauth2 

  See config.js.example to set these up. 
  */
  passport.use(new Strategy({
    clientID: client.appInfo.id,
    clientSecret: client.config.dashboard.oauthSecret,
    callbackURL: client.config.dashboard.callbackURL,
    scope: ['identify', 'guilds']
  },
  (accessToken, refreshToken, profile, done) => {
    process.nextTick(() => done(null, profile));
  }));

  
  // Session data, used for temporary storage of your visitor's session information.
  // the `secret` is in fact a "salt" for the data, and should not be shared publicly.
  app.use(session({
    store: new LevelStore('./data/dashboard-session/'),
    secret: client.config.dashboard.sessionSecret,
    resave: false,
    saveUninitialized: false,
  }));

  // Initializes passport and session.
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(helmet());

  // The domain name used in various endpoints to link between pages.
  app.locals.domain = client.config.dashboard.domain;
  
  // The EJS templating engine gives us more power 
  app.engine('html', require('ejs').renderFile);
  app.set('view engine', 'html');

  // body-parser reads incoming JSON or FORM data and simplifies their
  // use in code.
  var bodyParser = require('body-parser');
  app.use(bodyParser.json());       // to support JSON-encoded bodies
  app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
    extended: true
  })); 

  /* 
  Authentication Checks. checkAuth verifies regular authentication,
  whereas checkAdmin verifies the bot owner. Those are used in url
  endpoints to give specific permissions. 
  */
  function checkAuth(req, res, next) {
    if (req.isAuthenticated()) return next();
    req.session.backURL = req.url;
    res.redirect('/login');
  }

  function checkAdmin(req, res, next) {
    if (req.isAuthenticated() && req.user.id === client.appInfo.owner.id) return next();
    req.session.backURL = req.originalURL;
    res.redirect('/');
  }

  // Index page. If the user is authenticated, it shows their info
  // at the top right of the screen.
  app.get('/', (req, res) => {
    res.render(path.resolve(`${templateDir}${path.sep}index.ejs`), {
      bot: client,
      path: req.path,
      auth: req.isAuthenticated() ? true : false,
      user: req.isAuthenticated() ? req.user : null
    });
  });

  // The login page saves the page the person was on in the session,
  // then throws the user to the Discord OAuth2 login page.
  app.get('/login', (req, res, next) => {
    if (req.session.backURL) {
      req.session.backURL = req.session.backURL;
    } else if (req.headers.referer) {
      const parsed = url.parse(req.headers.referer);
      if (parsed.hostname === app.locals.domain) {
        req.session.backURL = parsed.path;
      }
    } else {
      req.session.backURL = '/';
    }
    next();
  },
  passport.authenticate('discord'));

  app.get('/callback', passport.authenticate('discord', {
    failureRedirect: '/autherror'
  }), (req, res) => {
    if (req.session.backURL) {
      res.redirect(req.session.backURL);
      req.session.backURL = null;
    } else {
      res.redirect('/');
    }
  });
  
  app.get('/autherror', (req, res) => {
    res.render(path.resolve(`${templateDir}${path.sep}autherror.ejs`), {
      bot: client,
      path: req.path,
      auth: req.isAuthenticated() ? true : false,
      user: req.isAuthenticated() ? req.user : null
    });
  });

  app.get('/admin', checkAdmin, (req, res) => {
    res.render(path.resolve(`${templateDir}${path.sep}admin.ejs`), {
      bot: client,
      path: req.path,
      user: req.user,
      auth: true
    });
  });

  app.get('/dashboard', checkAuth, (req, res) => {
    const perms = Discord.EvaluatedPermissions;
    res.render(path.resolve(`${templateDir}${path.sep}dashboard.ejs`), {
      perms: perms,
      bot: client,
      path: req.path,
      user: req.user,
      auth: true
    });
  });

  app.get('/dashboard/:guildID', checkAuth, (req, res) => {
    res.redirect(`/dashboard/${req.params.guildID}/manage`);
  });
  
  app.get('/dashboard/:guildID/members', checkAuth, async (req, res) => {
    const guild = client.guilds.get(req.params.guildID);
    if (!guild) return res.status(404);
    if (req.params.fetch) {
      await guild.fetchMembers();
    }
    res.render(path.resolve(`${templateDir}${path.sep}members.ejs`), {
      bot: client,
      user: req.user,
      path: req.path,
      auth: true,
      guild: guild,
      members: guild.members.array()
    });
  });

  app.get('/dashboard/:guildID/members/list', checkAuth, async (req, res) => {
    const guild = client.guilds.get(req.params.guildID);
    if (!guild) return res.status(404);
    if (req.query.fetch) {
      await guild.fetchMembers();
    }
    const totals = guild.members.size;
    const start = parseInt(req.query.start, 10) || 0;
    const limit = parseInt(req.query.limit, 10) || 50;
    let members = guild.members;
    
    if (req.query.filter && req.query.filter !== 'null') {
      //if (!req.query.filtervalue) return res.status(400);
      members = members.filter(m=> {
        m = req.query.filterUser ? m.user : m;
        return m['displayName'].toLowerCase().includes(req.query.filter.toLowerCase());
      });
    }
    
    if (req.query.sortby) {
      members = members.sort((a, b) => a[req.query.sortby] > b[req.query.sortby]);
    }
    const memberArray = members.array().slice(start, start+limit);
    
    const returnObject = [];
    for (let i = 0; i < memberArray.length; i++) {
      const m = memberArray[i];
      returnObject.push({
        id: m.id,
        status: m.user.presence.status,
        bot: m.user.bot,
        username: m.user.username,
        displayName: m.displayName,
        tag: m.user.tag,
        discriminator: m.user.discriminator,
        joinedAt: m.joinedTimestamp,
        createdAt: m.user.createdTimestamp,
        highestRole: {
          hexColor: m.highestRole.hexColor
        },
        memberFor: moment.duration(Date.now() - m.joinedAt).format(' D [days], H [hrs], m [mins], s [secs]'),
        roles: m.roles.map(r=>({
          name: r.name,
          id: r.id,
          hexColor: r.hexColor
        }))
      });
    }
    res.json({
      total: totals,
      page: (start/limit)+1,
      pageof: Math.ceil(members.size / limit),
      members: returnObject
    });
  });

  app.post('/dashboard/:guildID/manage', checkAuth, (req, res) => {
    const guild = client.guilds.get(req.params.guildID);
    if (!guild) return res.status(404);
    const isManaged = guild && !!guild.member(req.user.id) ? guild.member(req.user.id).permissions.has('MANAGE_GUILD') : false;
    if (req.user.id === client.appInfo.owner.id) {
      console.log(`Admin bypass for managing server: ${req.params.guildID}`);
    } else if (!isManaged) {
      res.redirect('/');
    }
    const settings = client.settings.get(guild.id);
    for (const key in settings) {
      settings[key] = req.body[key];
    }
    client.settings.set(guild.id, settings);
    res.redirect('/dashboard/'+req.params.guildID+'/manage');
  });
  
  app.get('/dashboard/:guildID/manage', checkAuth, (req, res) => {
    const guild = client.guilds.get(req.params.guildID);
    if (!guild) return res.status(404);
    const isManaged = guild && !!guild.member(req.user.id) ? guild.member(req.user.id).permissions.has('MANAGE_GUILD') : false;
    if (req.user.id === client.appInfo.owner.id) {
      console.log(`Admin bypass for managing server: ${req.params.guildID}`);
    } else if (!isManaged) {
      res.redirect('/');
    }
    res.render(path.resolve(`${templateDir}${path.sep}manage.ejs`), {
      bot: client,
      path: req.path,
      guild: guild,
      user: req.user,
      auth: true
    });
  });
  
  app.get('/dashboard/:guildID/leave', checkAuth, async (req, res) => {
    const guild = client.guilds.get(req.params.guildID);
    if (!guild) return res.status(404);
    const isManaged = guild && !!guild.member(req.user.id) ? guild.member(req.user.id).permissions.has('MANAGE_GUILD') : false;
    if (req.user.id === client.appInfo.owner.id) {
      console.log(`Admin bypass for managing server: ${req.params.guildID}`);
    } else if (!isManaged) {
      res.redirect('/');
    }
    await guild.leave();
    if (req.user.id === client.appInfo.owner.id) {
      return res.redirect('/admin');
    }
    res.redirect('/dashboard');
  });

  app.get('/dashboard/:guildID/reset', checkAuth, async (req, res) => {
    const guild = client.guilds.get(req.params.guildID);
    if (!guild) return res.status(404);
    const isManaged = guild && !!guild.member(req.user.id) ? guild.member(req.user.id).permissions.has('MANAGE_GUILD') : false;
    if (req.user.id === client.appInfo.owner.id) {
      console.log(`Admin bypass for managing server: ${req.params.guildID}`);
    } else if (!isManaged) {
      res.redirect('/');
    }
    client.settings.set(guild.id, client.config.defaultSettings);
    res.redirect('/dashboard/'+req.params.guildID);
  });
  
  
  app.get('/commands', (req, res) => {
    res.render(path.resolve(`${templateDir}${path.sep}commands.ejs`), {
      bot: client,
      path: req.path,
      auth: req.isAuthenticated() ? true : false,
      user: req.isAuthenticated() ? req.user : null,
      md: md
    });
  });
  
  app.get('/stats', (req, res) => {
    const duration = moment.duration(client.uptime).format(' D [days], H [hrs], m [mins], s [secs]');
    const members = client.guilds.reduce((p, c) => p + c.memberCount, 0);
    const textChannels = client.channels.filter(c => c.type === 'text').size;
    const voiceChannels = client.channels.filter(c => c.type === 'voice').size;
    const guilds = client.guilds.size;
    res.render(path.resolve(`${templateDir}${path.sep}stats.ejs`), {
      bot: client,
      path: req.path,
      auth: req.isAuthenticated() ? true : false,
      user: req.isAuthenticated() ? req.user : null,
      stats: {
        servers: guilds,
        members: members,
        text: textChannels,
        voice: voiceChannels,
        uptime: duration,
        memoryUsage: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2),
        dVersion: Discord.version,
        nVersion: process.version
      }
    });
  });

  app.get('/logout', function(req, res) {
    req.logout();
    res.redirect('/');
  });

  client.site = app.listen(client.config.dashboard.port);
};
