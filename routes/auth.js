const express = require('express');
const dbo = require('../db/conn');

const recordRoutes = express.Router();

recordRoutes.route('/auth/login').post(async (req, res) => {
  const { login, password } = req.body;
  try {
    const driver = await dbo.getDB();
    const { loggedUsers } = await driver.executeQuery(
      'MATCH (u:User {loggedIn: true}) RETURN u',
      { login, password },
      { database: 'neo4j' },
    );
    if (!loggedUsers) {
      const { records } = await driver.executeQuery(
        'MATCH (u:User {name: $login, password: $password}) RETURN u',
        { login, password },
        { database: 'neo4j' },
      );
      if (records.length > 0) {
        const { summary } = await driver.executeQuery(
          'MATCH (u:User {name: $login, password: $password}) SET u.loggedIn = true',
          { login, password },
          { database: 'neo4j' },
        );
        res.status(200).json({
          status: 'Success',
          result: `Successfully logged in as ${login} in ${summary.resultAvailableAfter} ms.`,
        });
      } else {
        res.status(200).json({
          status: 'Error',
          result: 'Username or password incorrect',
        });
      }
    } else {
      res.status(200).json({
        status: 'Error',
        result: 'Already logged in',
      });
    }
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/auth/logout').post(async (req, res) => {
  const { login } = req.body;
  try {
    const driver = await dbo.getDB();
    const { records } = await driver.executeQuery(
      'MATCH (u:User {name: $login, loggedIn: true}) RETURN u',
      { login },
      { database: 'neo4j' },
    );
    if (records.length > 0) {
      const { summary } = await driver.executeQuery(
        'MATCH (u:User {name: $login}) SET u.loggedIn = false',
        { login },
        { database: 'neo4j' },
      );
      res.status(200).json({
        status: 'Success',
        result: `Successfully logged out as ${login} in ${summary.resultAvailableAfter} ms.`,
      });
    } else {
      res.status(200).json({
        status: 'Error',
        result: 'Username incorrect or not logged in',
      });
    }
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/auth/password/reset').post(async (req, res) => {
  const { login, email, password } = req.body;
  try {
    const driver = await dbo.getDB();
    const { records } = await driver.executeQuery(
      'MATCH (u:User {name: $login, email: $email}) RETURN u',
      { login, email },
      { database: 'neo4j' },
    );
    if (records.length > 0) {
      const { summary } = await driver.executeQuery(
        'MATCH (u:User {name: $login}) SET u.password = $password',
        { login, password },
        { database: 'neo4j' },
      );
      res.status(200).json({
        status: 'Success',
        result: `Successfully reseted password in ${summary.resultAvailableAfter} ms.`,
      });
    } else {
      res.status(200).json({
        status: 'Error',
        result: 'Username or email incorrect',
      });
    }
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

module.exports = recordRoutes;
