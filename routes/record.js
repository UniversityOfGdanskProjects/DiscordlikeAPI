/* eslint-disable radix */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
// eslint-disable-next-line import/no-extraneous-dependencies
const { v4: uuidv4 } = require('uuid');
const upload = require('../upload');
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

recordRoutes.route('/channels').get(async (req, res) => {
  const { calls, user } = req.query;
  let query = 'MATCH (c:Channel)';
  if (calls) {
    query = `${query}, (c)-->(:Call)`;
  }
  if (user) {
    query = `${query}, (c)<--(:User {id: $user})`;
  }
  query = `${query} RETURN c`;
  try {
    const driver = await dbo.getDB();
    const { records } = await driver.executeQuery(
      query,
      { user },
      { database: 'neo4j' },
    );
    const results = [];
    records.forEach((record) => {
      results.push({
        id: record.get('c').properties.id,
        name: record.get('c').properties.name,
      });
    });
    res.status(200).json({
      status: 'Success',
      result: {
        channels: results,
      },
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/channels/:id').get(async (req, res) => {
  const { id } = req.params;
  try {
    const driver = await dbo.getDB();
    const { records } = await driver.executeQuery(
      'MATCH (c:Channel {id: $id}) RETURN c',
      { id },
      { database: 'neo4j' },
    );
    if (records.length > 0) {
      const result = {
        id: records[0].get('c').properties.id,
        name: records[0].get('c').properties.name,
      };
      res.status(200).json({
        status: 'Success',
        result: {
          channel: result,
        },
      });
    } else {
      res.status(200).json({
        status: 'Error',
        error: 'No channel found',
      });
    }
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/channels').post(async (req, res) => {
  const { name } = req.body;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MERGE (c:Channel {id: $id, name: $name})',
      {
        name,
        id: uuidv4(),
      },
      { database: 'neo4j' },
    );
    res.status(200).json({
      status: 'Success',
      result: `Created ${summary.counters.updates().nodesCreated} nodes `
              + `in ${summary.resultAvailableAfter} ms.`,
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/channels/:id').delete(async (req, res) => {
  const { id } = req.params;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (c:Channel {id: $id}) DETACH DELETE c',
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

recordRoutes.route('/channels/:id/users').post(async (req, res) => {
  const { id } = req.params;
  const { user } = req.body;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (c:Channel {id: $id}), (u:User {id: $user}) CREATE (u)-[:IS_IN]->(c)',
      { id, user },
      { database: 'neo4j' },
    );
    res.status(200).json({
      status: 'Success',
      result: `Created ${summary.counters.updates().relationshipsCreated} relationships `
              + `in ${summary.resultAvailableAfter} ms.`,
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/channels/:channel/users/:user').delete(async (req, res) => {
  const { channel, user } = req.params;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (:Channel {id: $channel})<-[r:IS_IN]-(:User {id: $user}) DELETE r',
      { channel, user },
      { database: 'neo4j' },
    );
    res.status(200).json({
      status: 'Success',
      result: `Deleted ${summary.counters.updates().relationshipsDeleted} relationships `
              + `in ${summary.resultAvailableAfter} ms.`,
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/channels/:id').put(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (c:Channel {id: $id}) SET c.name = $name',
      { id, name },
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

recordRoutes.route('/messages').post(async (req, res) => {
  const {
    text, user, channel,
  } = req.body;
  const date = new Date(Date.now()).toISOString();
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (u:User {id: $user})-->(c:Channel{id: $channel})\n'
      + 'CREATE (u)-[:SEND]->(m:Message {id: $messageId, text: $text, date: $date, edited: $edited})<-[:HAS_MESSAGE]-(c),\n'
      + '(n:Notification {id: $notifId, text: $notif, date: $date})<-[:SEND]-(m)\n'
      + 'WITH m, n\n'
      + 'MATCH (m)<--(:Channel)<--(a:User)\n'
      + 'CREATE (a)-[:HAS_NOTIFICATION {read: $edited}]->(n)',
      {
        messageId: uuidv4(), text, date, edited: false, user, channel, notifId: uuidv4(), notif: `New message in channel ${channel}`,
      },
      { database: 'neo4j' },
    );
    res.status(200).json({
      status: 'Success',
      result: `Created ${summary.counters.updates().nodesCreated} nodes `
              + `in ${summary.resultAvailableAfter} ms.`,
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/messages/:id').get(async (req, res) => {
  const { id } = req.params;
  try {
    const driver = await dbo.getDB();
    const { records } = await driver.executeQuery(
      'MATCH (m:Message {id: $id})'
    + 'OPTIONAL MATCH (c:Channel)-[:HAS_MESSAGE]->(m)'
    + 'OPTIONAL MATCH (m)<-[:SEND]-(u:User)'
    + 'RETURN m, u, c',
      { id },
      { database: 'neo4j' },
    );
    const results = {
      id: records[0].get('m').properties.id,
      text: records[0].get('m').properties.text,
      date: records[0].get('m').properties.date,
      edited: records[0].get('m').properties.edited,
      user: records[0].get('u').properties.id ? records[0].get('u').properties.id : 'User deleated',
      channel: records[0].get('c').properties.id.low,
    };
    res.status(200).json({
      status: 'Success',
      result: results,
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/messages/:id').delete(async (req, res) => {
  const { id } = req.params;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (m:Message {id: $id}) DETACH DELETE m',
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

recordRoutes.route('/messages/:id').put(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (m:Message {id: $id}) SET m.text = $text, m.edited = $edited',
      { id, text, edited: true },
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

recordRoutes.route('/messages').get(async (req, res) => {
  const { channel, user } = req.query;
  let query = 'MATCH';
  query = user ? `${query}(u:User {id: $user})-->` : `${query}(u:User)-->`;
  query = `${query}(m:Message)`;
  query = channel ? `${query}<--(c:Channel {id: $channel})` : `${query}<--(c:Channel)`;
  query = `${query} RETURN m, u.id AS u, c.id AS c`;
  try {
    const driver = await dbo.getDB();
    const { records } = await driver.executeQuery(
      query,
      { user, channel },
      { database: 'neo4j' },
    );
    const results = [];
    records.forEach((record) => {
      results.push({
        id: record.get('m').properties.id,
        user: record.get('u'),
        channel: record.get('c'),
        date: record.get('m').properties.date,
        text: record.get('m').properties.text,
        edited: record.get('m').properties.edited,
      });
    });
    res.status(200).json({
      status: 'Success',
      result: {
        messages: results,
      },
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/calls').post(async (req, res) => {
  const { user, channel, name } = req.body;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (u:User {id: $user})-->(ch:Channel{id: $channel})\n'
    + 'CREATE (u)-[:JOINED]->(c:Call {id: $id, date: $date, name: $name})<-[:HAS_CALLS]-(ch),\n'
    + '(n:Notification {id: $notifId, text: $notif, date: $date })<-[:SEND]-(c)\n'
    + 'WITH c, n\n'
    + 'MATCH (c)<--(:Channel)<--(a:User)\n'
    + 'CREATE (a)-[:HAS_NOTIFICATION {read: $read}]->(n)',
      {
        id: uuidv4(), date: new Date(Date.now()).toISOString(), user, channel, name, notifId: uuidv4(), notif: `New call in channel ${channel}`, read: false,
      },
      { database: 'neo4j' },
    );
    res.status(200).json({
      status: 'Success',
      result: `Created ${summary.counters.updates().nodesCreated} nodes `
            + `in ${summary.resultAvailableAfter} ms.`,
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/calls/:id').put(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (c:Call {id: $id}) SET c.name = $name',
      { id, name },
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

recordRoutes.route('/calls/:id').delete(async (req, res) => {
  const { id } = req.params;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (c:Call {id: $id}) DETACH DELETE c',
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

recordRoutes.route('/calls/:id').get(async (req, res) => {
  const { id } = req.params;
  try {
    const driver = await dbo.getDB();
    const { records } = await driver.executeQuery(
      'MATCH (u:User)-[:JOINED]->(c:Call {id: $id})<-[:HAS_CALLS]-(ch:Channel)\n'
        + 'WITH u.id as coll, c AS call, ch AS channel\n'
        + 'UNWIND coll AS x\n'
        + 'WITH x, call, channel\n'
        + 'WITH DISTINCT x, channel.id AS channel, call AS call\n'
        + 'RETURN collect(x) AS users, channel, call',
      { id },
      { database: 'neo4j' },
    );
    const results = {
      id: records[0].get('call').properties.id,
      date: records[0].get('call').properties.date,
      channel: records[0].get('channel').properties,
      users: records[0].get('users'),
    };
    res.status(200).json({
      status: 'Success',
      result: results,
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/calls/:id/users').post(async (req, res) => {
  const { id } = req.params;
  const { user } = req.body;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (u:User {id: $user})-->(:Channel)-->(c:Call{id: $id}) CREATE (u)-[:JOINED]->(c)',
      { id, user },
      { database: 'neo4j' },
    );
    res.status(200).json({
      status: 'Success',
      result: `Created ${summary.counters.updates().relationshipsCreated} relationships `
            + `in ${summary.resultAvailableAfter} ms.`,
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/calls/:call/users/:user').delete(async (req, res) => {
  const { call, user } = req.params;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (:Call {id: $call})<-[r:JOINED]-(:User {id: $user}) DELETE r',
      { call, user },
      { database: 'neo4j' },
    );
    res.status(200).json({
      status: 'Success',
      result: `Deleted ${summary.counters.updates().relationshipsDeleted} relationships `
            + `in ${summary.resultAvailableAfter} ms.`,
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/calls').get(async (req, res) => {
  const { channel, user, screenshare } = req.query;
  let query = 'MATCH';
  query = user ? `${query}(u:User {id: $user})-->` : `${query}`;
  query = `${query}(c:Call)`;
  query = channel ? `${query}<--(ch:Channel {id: $channel})` : `${query}<--(ch:Channel)`;
  query = screenshare ? `${query}, (c)-->(:Screenshare)` : query;
  query = `${query} RETURN c`;
  try {
    const driver = await dbo.getDB();
    const { records } = await driver.executeQuery(
      query,
      { user, channel, screenshare },
      { database: 'neo4j' },
    );
    const results = [];
    records.forEach((record) => {
      results.push({
        id: record.get('c').properties.id,
        name: record.get('c').properties.name,
        // channel: record.get('ch'),
        date: record.get('c').properties.date,
      });
    });
    res.status(200).json({
      status: 'Success',
      result: {
        calls: results,
      },
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/screenshares').post(async (req, res) => {
  const { user, call, name } = req.body;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (u:User {id: $user})-->(:Channel)-->(c:Call {id: $call})'
        + 'CREATE (u)-[:STARTED]->(s:Screenshare {id: $id, date: $date, name: $name})<-[:HAS_SCREENSHARE]-(c)',
      {
        id: uuidv4(), date: new Date(Date.now()).toISOString(), user, call, name,
      },
      { database: 'neo4j' },
    );
    res.status(200).json({
      status: 'Success',
      result: `Created ${summary.counters.updates().nodesCreated} nodes `
            + `in ${summary.resultAvailableAfter} ms.`,
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/screenshares/:id').delete(async (req, res) => {
  const { id } = req.params;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (s:Screenshare {id: $id}) DETACH DELETE s',
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

recordRoutes.route('/screenshares/:id').put(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (c:Screenshare {id: $id}) SET c.name = $name',
      { id, name },
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

recordRoutes.route('/screenshares/:id').get(async (req, res) => {
  const { id } = req.params;
  try {
    const driver = await dbo.getDB();
    const { records } = await driver.executeQuery(
      'MATCH (u:User)-[:STARTED]->(s:Screenshare {id: $id})<-[:HAS_SCREENSHARE]-(c:Call)\n'
        + 'RETURN u.id AS user, s AS screenshare, c.id AS call',
      { id },
      { database: 'neo4j' },
    );
    const results = {
      id: records[0].get('screenshare').properties.id,
      name: records[0].get('screenshare').properties.name,
      date: records[0].get('screenshare').properties.date,
      call: records[0].get('call'),
      user: records[0].get('user'),
    };
    res.status(200).json({
      status: 'Success',
      result: results,
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/screenshares').get(async (req, res) => {
  const { channel, user, call } = req.query;
  let query = 'MATCH';
  query = user ? `${query} (u:User { id: $user })-->` : `${query} (:User)-->`;
  query = `${query}(s:Screenshare)`;
  query = call ? `${query}<--(c:Call { id: $call})` : `${query}<--(c:Call)`;
  query = channel ? `${query}<--(ch:Channel { id: $channel })` : `${query}<--(ch:Channel)`;
  query = `${query} RETURN s, ch.id AS ch, c.id AS c`;
  try {
    const driver = await dbo.getDB();
    const { records } = await driver.executeQuery(
      query,
      { user, channel, call },
      { database: 'neo4j' },
    );
    const results = [];
    records.forEach((record) => {
      results.push({
        id: record.get('s').properties.id,
        name: record.get('s').properties.name,
        call: record.get('c'),
        channel: record.get('ch'),
        date: record.get('s').properties.date,
      });
    });
    res.status(200).json({
      status: 'Success',
      result: {
        screenshares: results,
      },
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.post('/files', [cors(), upload.single('file')], async (req, res) => {
  const {
    user, channel, description,
  } = req.body;
  try {
    const image = fs.readFileSync(req.file.path);
    const base64Image = `data:image/png;base64,${Buffer.from(image, 'binary').toString('base64')}`;
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (u:User {id: $user})-->(ch:Channel{id: $channel})\n'
    + 'CREATE (u)-[:SEND]->(f:File {id: $id, name: $name, date: $date, description: $description, file: $file, edited: $edited})<-[:HAS_FILES]-(ch),\n'
    + '(n:Notification {id: $notifId, text: $notif, date: $date })<-[:SEND]-(f)\n'
    + 'WITH f, n\n'
    + 'MATCH (f)<--(:Channel)<--(a:User)\n'
    + 'CREATE (a)-[:HAS_NOTIFICATION { read: $edited }]->(n)\n',
      {
        id: uuidv4(),
        name: req.file.path,
        date: new Date(Date.now()).toISOString(),
        user,
        channel,
        description,
        file: base64Image,
        edited: false,
        notifId: uuidv4(),
        notif: `New file in ${channel}`,
      },
      { database: 'neo4j' },
    );
    res.status(200).json({
      status: 'Success',
      result: `Created ${summary.counters.updates().nodesCreated} nodes `
            + `in ${summary.resultAvailableAfter} ms.`,
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/files/:id').delete(async (req, res) => {
  const { id } = req.params;
  try {
    const driver = await dbo.getDB();
    const { records } = await driver.executeQuery(
      'MATCH (f:File {id: $id}) RETURN f.name AS f',
      { id },
      { database: 'neo4j' },
    );
    const { summary } = await driver.executeQuery(
      'MATCH (f:File {id: $id}) DETACH DELETE f',
      { id },
      { database: 'neo4j' },
    );
    fs.unlinkSync(records[0].get('f'));
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

recordRoutes.route('/files/:id').get(async (req, res) => {
  const { id } = req.params;
  try {
    const driver = await dbo.getDB();
    const { records } = await driver.executeQuery(
      'MATCH (u:User)-->(f:File {id: $id})<--(c:Channel) RETURN f, u.id AS u, c.id AS c',
      { id },
      { database: 'neo4j' },
    );
    const result = {
      id: records[0].get('f').properties.id,
      name: records[0].get('f').properties.name,
      date: records[0].get('f').properties.date,
      user: records[0].get('u'),
      channel: records[0].get('c'),
      description: records[0].get('f').properties.description,
      edited: records[0].get('f').properties.edited,
      file: records[0].get('f').properties.file,
    };
    res.status(200).json({
      status: 'Success',
      result: {
        file: result,
      },
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/files').get(async (req, res) => {
  const { channel, user } = req.query;
  let query = 'MATCH ';
  query = channel ? `${query}(c:Channel { id: $channel })-->` : `${query}(c:Channel)-->`;
  query = `${query}(f:File)`;
  query = user ? `${query}<--(u:User { id : $user})` : `${query}<--(u:User)`;
  query = `${query} RETURN f, c.id AS c, u.id AS u`;
  try {
    const driver = await dbo.getDB();
    const { records } = await driver.executeQuery(
      query,
      { user, channel },
      { database: 'neo4j' },
    );
    const results = [];
    records.forEach((record) => {
      results.push({
        id: record.get('f').properties.id,
        name: record.get('f').properties.name,
        date: record.get('f').properties.date,
        user: record.get('u'),
        channel: record.get('c'),
        description: record.get('f').properties.description,
        edited: record.get('f').properties.edited,
        file: record.get('f').properties.file,
      });
    });
    res.status(200).json({
      status: 'Success',
      result: {
        files: results,
      },
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/files/:id').put(async (req, res) => {
  const { id } = req.params;
  const { description } = req.body;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (f:File {id: $id}) SET f.description = $description, f.edited = $edited',
      { id, description, edited: true },
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

recordRoutes.route('/notifications').get(async (req, res) => {
  try {
    const driver = await dbo.getDB();
    const { records } = await driver.executeQuery(
      'MATCH (:User{loggedIn: true})-[r]->(n:Notification) RETURN n, r.read AS r',
      {},
      { database: 'neo4j' },
    );
    const results = [];
    records.forEach((record) => {
      results.push({
        id: record.get('n').properties.id,
        date: record.get('n').properties.date,
        text: record.get('n').properties.text,
        read: record.get('r'),
      });
    });
    res.status(200).json({
      status: 'Success',
      result: {
        notifications: results,
      },
    });
  } catch (err) {
    res.json({
      status: 'Error',
      message: err,
    });
  }
});

recordRoutes.route('/notifications/:user').put(async (req, res) => {
  const { user } = req.params;
  const { notification } = req.query;
  let query = '';
  if (notification) {
    query = 'MATCH (:User{id: $user})-[r]->(n:Notification{id: $notification}) SET r.read = true';
  } else {
    query = 'MATCH (:User{id: $user})-[r]->(n:Notification) SET r.read = true';
  }
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      query,
      { user, notification },
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

recordRoutes.route('/notifications/:id').delete(async (req, res) => {
  const { id } = req.params;
  try {
    const driver = await dbo.getDB();
    const { summary } = await driver.executeQuery(
      'MATCH (n:Notification{id: $id}) DETACH DELETE n',
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
