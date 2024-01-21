/* eslint-disable radix */
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { log } = require('console');
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

recordRoutes.route('/messages').get(async (req, res) => {
  const { channel, user } = req.query;
  let query = 'MATCH (u:User)-->(m:Message)<--(c:Channel)';
  if (channel) {
    query = `${query}, (m)-->(:Channel {id: $channel})`;
  }
  if (user) {
    query = `${query}, (m)<--(:User {id: $user})`;
  }
  query = `${query} RETURN m, u.id AS u, c.id AS c`;
  const driver = await dbo.getDB();
  const { records, _ } = await driver.executeQuery(
    query,
    { user: parseInt(user), channel: parseInt(channel) },
    { database: 'neo4j' },
  );
  const results = [];
  records.forEach((record) => {
    results.push({
      id: record.get('m').properties.id.low,
      user: record.get('u').low,
      channel: record.get('c').low,
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

recordRoutes.route('/calls').get(async (req, res) => {
  const { channel, user, screenshare } = req.query;
  let query = 'MATCH (ch:Channel)-->(c:Call)';
  if (channel) {
    query = `${query}, (c)<--(:Channel {id: $channel})`;
  }
  if (user) {
    query = `${query}, (c)<--(:User {id: $user})`;
  }
  if (screenshare) {
    query = `${query}, (c)<--(:Screenshare)`;
  }
  query = `${query} RETURN c, ch.id AS ch`;
  const driver = await dbo.getDB();
  const { records, _ } = await driver.executeQuery(
    query,
    { user: parseInt(user), channel: parseInt(channel) },
    { database: 'neo4j' },
  );
  const results = [];
  records.forEach((record) => {
    results.push({
      id: record.get('c').properties.id,
      channel: record.get('ch').low,
      date: record.get('c').properties.date,
    });
  });
  res.status(200).json({
    status: 'Success',
    result: {
      calls: results,
    },
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

recordRoutes.route('/screenshares/:id').get(async (req, res) => {
  const { id } = req.params;
  const driver = await dbo.getDB();
  const { records, summary } = await driver.executeQuery(
    'MATCH (u:User)-[:STARTED]->(s:Screenshare {id: $id})<-[:HAS_SCREENSHARE]-(c:Call)\n'
        + 'RETURN u.id AS user, s AS screenshare, c.id AS call',
    { id: parseInt(id) },
    { database: 'neo4j' },
  );
  const results = {
    id: records[0].get('screenshare').properties.id,
    date: records[0].get('screenshare').properties.date,
    call: records[0].get('call'),
    user: records[0].get('user').low,
  };
  res.status(200).json({
    status: 'Success',
    result: results,
  });
});

recordRoutes.route('/screenshares').get(async (req, res) => {
  const { channel, user, call } = req.query;
  let query = 'MATCH (ch:Channel)-->(c:Call)-->(s:Screenshare)';
  if (channel) {
    query = `${query}, (s)<--(c)<--(:Channel {id: $channel})`;
  }
  if (user) {
    query = `${query}, (s)<--(:User {id: $user})`;
  }
  if (call) {
    query = `${query}, (s)<--(:Call {id: $call})`;
  }
  query = `${query} RETURN s, ch.id AS ch, c.id AS c`;
  const driver = await dbo.getDB();
  const { records, _ } = await driver.executeQuery(
    query,
    { user: parseInt(user), channel: parseInt(channel), call: parseInt(call) },
    { database: 'neo4j' },
  );
  const results = [];
  records.forEach((record) => {
    results.push({
      id: record.get('s').properties.id,
      call: record.get('c'),
      channel: record.get('ch').low,
      date: record.get('s').properties.date,
    });
  });
  res.status(200).json({
    status: 'Success',
    result: {
      screenshares: results,
    },
  });
});

recordRoutes.post('/files', [cors(), upload.single('file')], async (req, res) => {
  const {
    id, user, channel, description,
  } = req.body;
  const image = fs.readFileSync(req.file.path);
  const base64Image = `data:image/png;base64,${Buffer.from(image, 'binary').toString('base64')}`;
  const driver = await dbo.getDB();
  const { _, summary } = await driver.executeQuery(
    'MATCH (u:User {id: $user}), (c:Channel {id: $channel})'
        + 'CREATE (u)-[:SEND]->(f:File {id: $id, name: $name, date: $date, description: $description, file: $file, edited: false})<-[:HAS_FILES]-(c)',
    {
      id: parseInt(id),
      name: req.file.path,
      date: new Date(Date.now()).toISOString(),
      user: parseInt(user),
      channel: parseInt(channel),
      description,
      file: base64Image,
    },
    { database: 'neo4j' },
  );
  res.status(200).json({
    status: 'Success',
    result: `Created ${summary.counters.updates().nodesCreated} nodes `
            + `in ${summary.resultAvailableAfter} ms.`,
  });
});

recordRoutes.route('/files/:id').delete(async (req, res) => {
  const { id } = req.params;
  const driver = await dbo.getDB();
  const { records, s } = await driver.executeQuery(
    'MATCH (f:File {id: $id}) RETURN f.name AS f',
    { id: parseInt(id) },
    { database: 'neo4j' },
  );
  const { r, summary } = await driver.executeQuery(
    'MATCH (f:File {id: $id}) DETACH DELETE f',
    { id: parseInt(id) },
    { database: 'neo4j' },
  );
  fs.unlinkSync(records[0].get('f'));
  res.status(200).json({
    status: 'Success',
    result: `Deleted ${summary.counters.updates().nodesDeleted} nodes `
    + `in ${summary.resultAvailableAfter} ms.`,
  });
});

recordRoutes.route('/files/:id').get(async (req, res) => {
  const { id } = req.params;
  const driver = await dbo.getDB();
  const { records } = await driver.executeQuery(
    'MATCH (u:User)-->(f:File {id: $id})<--(c:Channel) RETURN f, u.id AS u, c.id AS c',
    { id: parseInt(id) },
    { database: 'neo4j' },
  );
  const result = {
    id: records[0].get('f').properties.id.low,
    name: records[0].get('f').properties.name,
    date: records[0].get('f').properties.date,
    user: records[0].get('u').low,
    channel: records[0].get('c').low,
    description: records[0].get('f').properties.description,
    file: records[0].get('f').properties.file,
  };
  res.status(200).json({
    status: 'Success',
    result: {
      file: result,
    },
  });
});

recordRoutes.route('/files').get(async (req, res) => {
  const { channel, user } = req.query;
  let query = 'MATCH (c:Channel)-->(f:File)<--(u:User)';
  if (channel) {
    query = `${query}, (f)<--(:Channel {id: $channel})`;
  }
  if (user) {
    query = `${query}, (f)<--(:User {id: $user})`;
  }
  query = `${query} RETURN f, c.id AS c, u.id AS u`;
  const driver = await dbo.getDB();
  const { records } = await driver.executeQuery(
    query,
    { user: parseInt(user), channel: parseInt(channel) },
    { database: 'neo4j' },
  );
  const results = [];
  records.forEach((record) => {
    results.push({
      id: record.get('f').properties.id.low,
      name: record.get('f').properties.name,
      date: record.get('f').properties.date,
      user: record.get('u').low,
      channel: record.get('c').low,
      description: record.get('f').properties.description,
      file: record.get('f').properties.file,
    });
  });
  res.status(200).json({
    status: 'Success',
    result: {
      files: results,
    },
  });
});

module.exports = recordRoutes;
