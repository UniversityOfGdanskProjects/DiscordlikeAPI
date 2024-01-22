const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dbo = require('../db/conn');

const recordRoutes = express.Router();

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
          + 'WITH u as coll, c AS call, ch AS channel\n'
          + 'UNWIND coll AS x\n'
          + 'WITH x, call, channel\n'
          + 'WITH DISTINCT x, channel AS channel, call AS call\n'
          + 'RETURN collect(x) AS users, channel, call',
      { id },
      { database: 'neo4j' },
    );
    const results = {
      id: records[0].get('call').properties.id,
      date: records[0].get('call').properties.date,
      channel: records[0].get('channel').properties,
      users: records[0].get('users').map((record) => ({ id: record.properties.id, name: record.properties.name })),
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
  query = `${query} RETURN c, ch`;
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
        channel: { id: record.get('ch').properties.id, name: record.get('ch').properties.name },
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

module.exports = recordRoutes;
