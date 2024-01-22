/* eslint-disable global-require */
(async () => {
  const express = require('express');
  const cors = require('cors');
  require('dotenv').config({ path: require('find-config')('.env') });
  const port = process.env.PORT || 5000;
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(require('./routes/auth'));
  app.use(require('./routes/calls'));
  app.use(require('./routes/channels'));
  app.use(require('./routes/files'));
  app.use(require('./routes/messages'));
  app.use(require('./routes/notifications'));
  app.use(require('./routes/screenshares'));
  app.use(require('./routes/users'));

  const dbo = require('./db/conn');

  app.listen(port, () => {
    dbo.connectToDB();
    // eslint-disable-next-line no-console
    console.log(`Server is running on ${port}`);
  });
})();
