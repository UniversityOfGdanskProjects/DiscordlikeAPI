const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dbo = require('../db/conn');

const recordRoutes = express.Router();

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
          + 'RETURN u AS user, s AS screenshare, c AS call',
      { id },
      { database: 'neo4j' },
    );
    const results = {
      id: records[0].get('screenshare').properties.id,
      name: records[0].get('screenshare').properties.name,
      date: records[0].get('screenshare').properties.date,
      call: { id: records[0].get('call').properties.id, name: records[0].get('call').properties.name },
      user: { id: records[0].get('user').properties.id, name: records[0].get('user').properties.name },
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
  query = `${query} RETURN s, ch, c`;
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
        call: { id: record.get('c').properties.id, name: record.get('c').properties.name },
        channel: { id: record.get('ch').properties.id, name: record.get('ch').properties.name },
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

module.exports = recordRoutes;
