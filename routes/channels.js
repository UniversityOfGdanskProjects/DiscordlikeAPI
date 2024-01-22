const express = require('express');
const { v4: uuidv4 } = require('uuid');
const dbo = require('../db/conn');

const recordRoutes = express.Router();

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
      'MATCH (c:Channel {id: $id})<--(u:User) RETURN c, u',
      { id },
      { database: 'neo4j' },
    );
    if (records.length > 0) {
      const result = {
        id: records[0].get('c').properties.id,
        name: records[0].get('c').properties.name,
        users: records.map((record) => ({
          id: record.get('u').properties.id,
          name: record.get('u').properties.name,
        })),
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

module.exports = recordRoutes;
