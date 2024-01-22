const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dbo = require('../db/conn');

const recordRoutes = express.Router();

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
      user: records[0].get('u').properties.id ? { id: records[0].get('u').properties.id, name: records[0].get('u').properties.name } : 'User deleted',
      channel: { id: records[0].get('c').properties.id, name: records[0].get('c').properties.name },
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
  query = `${query} RETURN m, u, c`;
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
        user: { id: record.get('u').properties.id, name: record.get('u').properties.name },
        channel: { id: record.get('c').properties.id, name: record.get('c').properties.name },
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

module.exports = recordRoutes;
