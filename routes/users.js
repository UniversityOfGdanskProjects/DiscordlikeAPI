const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dbo = require('../db/conn');

const recordRoutes = express.Router();

recordRoutes.route('/users').get(async (req, res) => {
  const { calls, channel, screenshare } = req.query;
  let query = 'MATCH (u:User)';
  if (calls) {
    query = `${query}, (u)-->(:Call)`;
  }
  if (channel) {
    query = `${query}, (u)-->(:Channel {id: $channel})`;
  }
  if (screenshare) {
    query = `${query}, (u)-->(:Screenshare)`;
  }
  query = `${query} RETURN u`;
  try {
    const driver = await dbo.getDB();
    const { records } = await driver.executeQuery(
      query,
      { channel },
      { database: 'neo4j' },
    );
    const results = [];
    records.forEach((record) => {
      const { id } = record.get('u').properties;
      results.push({
        id,
        name: record.get('u').properties.name,
        email: record.get('u').properties.email,
      });
    });
    res.status(200).json({
      status: 'Success',
      result: {
        users: results,
      },
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/users').post(async (req, res) => {
  const {
    name, password, email,
  } = req.body;
  try {
    const driver = await dbo.getDB();
    const { records } = await driver.executeQuery(
      'MATCH (u:User {name: $name}) RETURN u',
      {
        name,
      },
      { database: 'neo4j' },
    );
    if (records.length > 0) {
      res.status(200).json({
        status: 'Error',
        result: 'This username already exists',
      });
    } else {
      const { summary } = await driver.executeQuery(
        'MERGE (u:User {id: $id, name: $name, password: $password, email : $email, loggedIn: false})',
        {
          name,
          id: uuidv4(),
          password,
          email,
        },
        { database: 'neo4j' },
      );
      res.status(200).json({
        status: 'Success',
        result: `Created ${summary.counters.updates().nodesCreated} nodes `
                  + `in ${summary.resultAvailableAfter} ms.`,
      });
    }
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/users/:id').get(async (req, res) => {
  const { id } = req.params;
  try {
    const driver = await dbo.getDB();
    const { records } = await driver.executeQuery(
      'MATCH (u:User {id: $id})\n'
            + 'OPTIONAL MATCH (u)-[:IS_IN]->(ch:Channel)\n'
            + 'OPTIONAL MATCH (u)-[:JOINED]-(c:Call)\n'
            + 'RETURN u AS user, ch AS channels, c AS call',
      { id },
      { database: 'neo4j' },
    );
    if (records.length > 0) {
      const result = {
        id,
        name: records[0].get('user').properties.name,
        password: records[0].get('user').properties.loggedIn ? records[0].get('user').properties.password : undefined,
        email: records[0].get('user').properties.email,
        channels: records.map((record) => ({
          id: record.get('channels').properties.id,
          name: record.get('channels').properties.name,
        })),
        activity: records[0].get('call') ? `In call ${records[0].get('call').properties.name}, id: ${records[0].get('call').properties.id}` : 'No activity',
      };
      res.status(200).json({
        status: 'Success',
        result: {
          user: result,
        },
      });
    } else {
      res.status(200).json({
        status: 'Error',
        error: 'No user found',
      });
    }
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/users/:id').delete(async (req, res) => {
  const { id } = req.params;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (n:User {id: $id}) DETACH DELETE n',
      { id },
      { database: 'neo4j' },
    );
    res.status(200).json({
      status: 'Success',
      result: `Deleted ${summary.counters.updates().nodesDeleted} nodes `
                + `in ${summary.resultAvailableAfter} ms.`,
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/users/:id').put(async (req, res) => {
  const { id } = req.params;
  const { name, email } = req.body;
  let query = 'MATCH (u:User {id: $id}) SET ';
  query = name ? `${query} u.name = $name` : query;
  query = (name && email) ? `${query},` : query;
  query = email ? `${query} u.email = $email` : query;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      query,
      {
        id, name, email,
      },
      { database: 'neo4j' },
    );
    res.status(200).json({
      status: 'Success',
      result: `Set ${summary.counters.updates().propertiesSet} properties `
                + `in ${summary.resultAvailableAfter} ms.`,
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

module.exports = recordRoutes;
