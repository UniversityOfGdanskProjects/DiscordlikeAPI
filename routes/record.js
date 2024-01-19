/* eslint-disable radix */
const express = require('express');
const dbo = require('../db/conn');

const recordRoutes = express.Router();

recordRoutes.route('/users').get(async (req, res) => {
  const { calls, channel } = req.query;
  let query = 'MATCH (u:User)';
  if (calls) {
    query = `${query}, (u)-->(:Call)`;
  }
  if (channel) {
    query = `${query}, (u)-->(:Channel {id: $channel})`;
  }
  query = `${query} RETURN u`;
  const driver = await dbo.getDB();
  const { records } = await driver.executeQuery(
    query,
    { channel: parseInt(channel) },
    { database: 'neo4j' },
  );
  const results = [];
  records.forEach((record) => {
    const { id } = record.get('u').properties;
    results.push({
      id: id.low ? id.low : id,
      name: record.get('u').properties.name,
      isAdmin: record.get('u').properties.isAdmin,
    });
  });
  res.status(200).json({
    status: 'Success',
    result: {
      users: results,
    },
  });
});

recordRoutes.route('/users').post(async (req, res) => {
  const {
    name, id, password, isAdmin,
  } = req.body;
  const driver = await dbo.getDB();
  const { _, summary } = await driver.executeQuery(
    'MERGE (u:User {id: $id, name: $name, password: $password, isAdmin: $isAdmin})',
    {
      name,
      id: parseInt(id),
      password,
      isAdmin,
    },
    { database: 'neo4j' },
  );
  res.status(200).json({
    status: 'Success',
    result: `Created ${summary.counters.updates().nodesCreated} nodes `
            + `in ${summary.resultAvailableAfter} ms.`,
  });
});

recordRoutes.route('/users/:id').get(async (req, res) => {
  const { id } = req.params;
  const driver = await dbo.getDB();
  const { records, _ } = await driver.executeQuery(
    'MATCH (u:User {id: $id})\n'
        + 'OPTIONAL MATCH (u)-[:IS_IN]->(ch:Channel)\n'
        + 'OPTIONAL MATCH (u)-[:JOINED]-(c:Call)\n'
        + 'RETURN u AS user, ch.id AS channels, c.id AS call',
    { id: parseInt(id) },
    { database: 'neo4j' },
  );
  if (records.length > 0) {
    const result = {
      id: parseInt(id),
      name: records[0].get('user').properties.name,
      password: records[0].get('user').properties.password,
      isAdmin: records[0].get('user').properties.isAdmin,
      channels: records.map((record) => record.get('channels').low),
      activity: records[0].get('call') ? `In call ${records[0].get('call')}` : 'No activity',
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
});

recordRoutes.route('/users/:id').delete(async (req, res) => {
  const { id } = req.params;
  const driver = await dbo.getDB();
  const { _, summary } = await driver.executeQuery(
    'MATCH (n:User {id: $id}) DETACH DELETE n',
    { id: parseInt(id) },
    { database: 'neo4j' },
  );
  res.status(200).json({
    status: 'Success',
    result: `Deleted ${summary.counters.updates().nodesDeleted} nodes `
            + `in ${summary.resultAvailableAfter} ms.`,
  });
});

recordRoutes.route('/users/:id').put(async (req, res) => {
  const { id } = req.params;
  const { name, password, isAdmin } = req.body;
  let query = 'MATCH (u:User {id: $id})';
  if (name) {
    query = `${query} SET u.name = $name`;
  }
  if (password) {
    query = `${query} SET u.password = $password`;
  }
  if (isAdmin) {
    query = `${query} SET u.isAdmin = $isAdmin`;
  }
  const driver = await dbo.getDB();
  const { _, summary } = await driver.executeQuery(
    query,
    {
      id: parseInt(id), name, password, isAdmin,
    },
    { database: 'neo4j' },
  );
  res.status(200).json({
    status: 'Success',
    result: `Set ${summary.counters.updates().propertiesSet} properties `
            + `in ${summary.resultAvailableAfter} ms.`,
  });
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
  const driver = await dbo.getDB();
  const { records, _ } = await driver.executeQuery(
    query,
    { user: parseInt(user) },
    { database: 'neo4j' },
  );
  const results = [];
  records.forEach((record) => {
    results.push({
      id: record.get('c').properties.id.low,
      name: record.get('c').properties.name,
    });
  });
  res.status(200).json({
    status: 'Success',
    result: {
      channels: results,
    },
  });
});

recordRoutes.route('/channels/:id').get(async (req, res) => {
  const { id } = req.params;
  const driver = await dbo.getDB();
  const { records, _ } = await driver.executeQuery(
    'MATCH (c:Channel {id: $id}) RETURN c',
    { id: parseInt(id) },
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
});

recordRoutes.route('/channels').post(async (req, res) => {
  const { name, id } = req.body;
  const driver = await dbo.getDB();
  const { _, summary } = await driver.executeQuery(
    'MERGE (c:Channel {id: $id, name: $name})',
    {
      name,
      id: parseInt(id),
    },
    { database: 'neo4j' },
  );
  res.status(200).json({
    status: 'Success',
    result: `Created ${summary.counters.updates().nodesCreated} nodes `
            + `in ${summary.resultAvailableAfter} ms.`,
  });
});

recordRoutes.route('/channels/:id').delete(async (req, res) => {
  const { id } = req.params;
  const driver = await dbo.getDB();
  const { _, summary } = await driver.executeQuery(
    'MATCH (c:Channel {id: $id}) DETACH DELETE c',
    { id: parseInt(id) },
    { database: 'neo4j' },
  );
  res.status(200).json({
    status: 'Success',
    result: `Deleted ${summary.counters.updates().nodesDeleted} nodes `
            + `in ${summary.resultAvailableAfter} ms.`,
  });
});

recordRoutes.route('/channels/:id/users').post(async (req, res) => {
  const { id } = req.params;
  const { users } = req.body;
  const query = users.reduce((acc, curr, i) => `${acc}, (u${i}:User {id: ${curr}})`, 'MATCH (c:Channel {id: $id})');
  const queryFinal = users.reduce((acc, curr, i) => {
    if (i !== 0) {
      return `${acc}, (u${i})-[:IS_IN]->(c)`;
    }
    return `${acc} (u${i})-[:IS_IN]->(c)`;
  }, `${query}\nCREATE`);
  const driver = await dbo.getDB();
  const { records, summary } = await driver.executeQuery(
    queryFinal,
    { id: parseInt(id) },
    { database: 'neo4j' },
  );
  res.status(200).json({
    status: 'Success',
    result: `Created ${summary.counters.updates().relationshipsCreated} relationships `
            + `in ${summary.resultAvailableAfter} ms.`,
  });
});

recordRoutes.route('/channels/:channelId/users/:userId').delete(async (req, res) => {
  const { channelId, userId } = req.params;
  const driver = await dbo.getDB();
  const { records, summary } = await driver.executeQuery(
    'MATCH (:Channel {id: $channel})<-[r:IS_IN]-(:User {id: $user}) DELETE r',
    { channel: parseInt(channelId), user: parseInt(userId) },
    { database: 'neo4j' },
  );
  res.status(200).json({
    status: 'Success',
    result: `Deleted ${summary.counters.updates().relationshipsDeleted} relationships `
            + `in ${summary.resultAvailableAfter} ms.`,
  });
});

recordRoutes.route('/channels/:id').put(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  if (name) {
    const driver = await dbo.getDB();
    const { records, summary } = await driver.executeQuery(
      'MATCH (c:Channel {id: $id}) SET c.name = $name',
      { id: parseInt(id), name },
      { database: 'neo4j' },
    );
    res.status(200).json({
      status: 'Success',
      result: `Set ${summary.counters.updates().propertiesSet} properties `
                + `in ${summary.resultAvailableAfter} ms.`,
    });
  } else {
    res.status(200).json({
      status: 'Error',
      result: 'No parameters given',
    });
  }
});

recordRoutes.route('/messages').post(async (req, res) => {
  const {
    id, text, user, channel,
  } = req.body;
  const date = new Date(Date.now()).toISOString();
  const driver = await dbo.getDB();
  const { _, summary } = await driver.executeQuery(
    'MATCH (u:User {id: $user}), (c:Channel {id: $channel})'
        + 'CREATE (u)-[:SEND]->(m:Message {id: $id, text: $text, date: $date, edited: $edited})<-[:HAS_MESSAGE]-(c)',
    {
      id: parseInt(id), text, date, edited: false, user, channel,
    },
    { database: 'neo4j' },
  );
  res.status(200).json({
    status: 'Success',
    result: `Created ${summary.counters.updates().nodesCreated} nodes `
            + `in ${summary.resultAvailableAfter} ms.`,
  });
});

recordRoutes.route('/messages/:id').get(async (req, res) => {
  const { id } = req.params;
  const driver = await dbo.getDB();
  const { records, _ } = await driver.executeQuery(
    'MATCH (c:Channel)-[:HAS_MESSAGE]->(m:Message {id: $id})<-[:SEND]-(u:User) RETURN m, u, c',
    { id: parseInt(id) },
    { database: 'neo4j' },
  );
  const results = {
    id: records[0].get('m').properties.id,
    text: records[0].get('m').properties.text,
    date: records[0].get('m').properties.date,
    edited: records[0].get('m').properties.edited,
    user: records[0].get('u').properties.id.low,
    channel: records[0].get('c').properties.id.low,
  };
  res.status(200).json({
    status: 'Success',
    result: results,
  });
});

recordRoutes.route('/messages/:id').delete(async (req, res) => {
  const { id } = req.params;
  const driver = await dbo.getDB();
  const { _, summary } = await driver.executeQuery(
    'MATCH (m:Message {id: $id}) DETACH DELETE m',
    { id: parseInt(id) },
    { database: 'neo4j' },
  );
  res.status(200).json({
    status: 'Success',
    result: `Deleted ${summary.counters.updates().nodesDeleted} nodes `
            + `in ${summary.resultAvailableAfter} ms.`,
  });
});

recordRoutes.route('/messages/:id').put(async (req, res) => {
  const { id } = req.params;
  const { text } = req.body;
  const driver = await dbo.getDB();
  const { _, summary } = await driver.executeQuery(
    'MATCH (m:Message {id: $id}) SET m.text = $text, m.edited = $edited',
    { id: parseInt(id), text, edited: true },
    { database: 'neo4j' },
  );
  res.status(200).json({
    status: 'Success',
    result: `Set ${summary.counters.updates().propertiesSet} properties `
            + `in ${summary.resultAvailableAfter} ms.`,
  });
});

recordRoutes.route('/calls').post(async (req, res) => {
  const { id, user, channel } = req.body;
  const driver = await dbo.getDB();
  const { _, summary } = await driver.executeQuery(
    'MATCH (u:User {id: $user}), (ch:Channel {id: $channel})'
        + 'CREATE (u)-[:JOINED]->(c:Call {id: $id, date: $date})<-[:HAS_CALLS]-(ch)',
    {
      id: parseInt(id), date: new Date(Date.now()).toISOString(), user, channel,
    },
    { database: 'neo4j' },
  );
  res.status(200).json({
    status: 'Success',
    result: `Created ${summary.counters.updates().nodesCreated} nodes `
            + `in ${summary.resultAvailableAfter} ms.`,
  });
});

recordRoutes.route('/calls/:id').delete(async (req, res) => {
  const { id } = req.params;
  const driver = await dbo.getDB();
  const { _, summary } = await driver.executeQuery(
    'MATCH (c:Call {id: $id}) DETACH DELETE c',
    { id: parseInt(id) },
    { database: 'neo4j' },
  );
  res.status(200).json({
    status: 'Success',
    result: `Deleted ${summary.counters.updates().nodesDeleted} nodes `
            + `in ${summary.resultAvailableAfter} ms.`,
  });
});

recordRoutes.route('/calls/:id').get(async (req, res) => {
  const { id } = req.params;
  const driver = await dbo.getDB();
  const { records, summary } = await driver.executeQuery(
    'MATCH (u:User)-[:JOINED]->(c:Call {id: $id})<-[:HAS_CALLS]-(ch:Channel)\n'
        + 'WITH u.id as coll, c AS call, ch AS channel\n'
        + 'UNWIND coll AS x\n'
        + 'WITH x, call, channel\n'
        + 'WITH DISTINCT x, channel.id AS channel, call AS call\n'
        + 'RETURN collect(x) AS users, channel, call',
    { id: parseInt(id) },
    { database: 'neo4j' },
  );
  const results = {
    id: records[0].get('call').properties.id,
    date: records[0].get('call').properties.date,
    channel: records[0].get('channel').properties,
    users: records[0].get('users').map((record) => record.low),
  };
  res.status(200).json({
    status: 'Success',
    result: results,
  });
});

recordRoutes.route('/calls/:id/users').post(async (req, res) => {
  const { id } = req.params;
  const { users } = req.body;
  const query = users.reduce((acc, curr, i) => `${acc}, (u${i}:User {id: ${curr}})`, 'MATCH (c:Call {id: $id})');
  const queryFinal = users.reduce((acc, curr, i) => {
    if (i !== 0) {
      return `${acc}, (u${i})-[:JOINED]->(c)`;
    }
    return `${acc} (u${i})-[:JOINED]->(c)`;
  }, `${query}\nCREATE`);
  // console.log(queryFinal)
  const driver = await dbo.getDB();
  const { records, summary } = await driver.executeQuery(
    queryFinal,
    { id: parseInt(id) },
    { database: 'neo4j' },
  );
  res.status(200).json({
    status: 'Success',
    result: `Created ${summary.counters.updates().relationshipsCreated} relationships `
            + `in ${summary.resultAvailableAfter} ms.`,
  });
});

recordRoutes.route('/calls/:callId/users/:userId').delete(async (req, res) => {
  const { callId, userId } = req.params;
  const driver = await dbo.getDB();
  const { records, summary } = await driver.executeQuery(
    'MATCH (:Call {id: $call})<-[r:JOINED]-(:User {id: $user}) DELETE r',
    { call: parseInt(callId), user: parseInt(userId) },
    { database: 'neo4j' },
  );
  res.status(200).json({
    status: 'Success',
    result: `Deleted ${summary.counters.updates().relationshipsDeleted} relationships `
            + `in ${summary.resultAvailableAfter} ms.`,
  });
});

recordRoutes.route('/screenshares').post(async (req, res) => {
  const { id, user, call } = req.body;
  const driver = await dbo.getDB();
  const { _, summary } = await driver.executeQuery(
    'MATCH (u:User {id: $user}), (c:Call {id: $call})'
        + 'CREATE (u)-[:STARTED]->(s:Screenshare {id: $id, date: $date})<-[:HAS_SCREENSHARE]-(c)',
    {
      id: parseInt(id), date: new Date(Date.now()).toISOString(), user, call,
    },
    { database: 'neo4j' },
  );
  res.status(200).json({
    status: 'Success',
    result: `Created ${summary.counters.updates().nodesCreated} nodes `
            + `in ${summary.resultAvailableAfter} ms.`,
  });
});

recordRoutes.route('/screenshares/:id').delete(async (req, res) => {
  const { id } = req.params;
  const driver = await dbo.getDB();
  const { _, summary } = await driver.executeQuery(
    'MATCH (s:Screenshare {id: $id}) DETACH DELETE s',
    { id: parseInt(id) },
    { database: 'neo4j' },
  );
  res.status(200).json({
    status: 'Success',
    result: `Deleted ${summary.counters.updates().nodesDeleted} nodes `
            + `in ${summary.resultAvailableAfter} ms.`,
  });
});

module.exports = recordRoutes;
