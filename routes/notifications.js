const express = require('express');
const dbo = require('../db/conn');

const recordRoutes = express.Router();

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

module.exports = recordRoutes;
