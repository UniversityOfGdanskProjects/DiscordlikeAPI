const express = require('express');
const { v4: uuidv4 } = require('uuid');
const cors = require('cors');
const fs = require('fs');
const upload = require('../upload');
const dbo = require('../db/conn');

const recordRoutes = express.Router();

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
      'MATCH (u:User)-->(f:File {id: $id})<--(c:Channel) RETURN f, u, c',
      { id },
      { database: 'neo4j' },
    );
    const result = {
      id: records[0].get('f').properties.id,
      name: records[0].get('f').properties.name,
      date: records[0].get('f').properties.date,
      user: { id: records[0].get('u').properties.id, name: records[0].get('u').properties.name },
      channel: { id: records[0].get('c').properties.id, name: records[0].get('c').properties.name },
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
  query = `${query} RETURN f, c, u`;
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
        user: { id: records[0].get('u').properties.id, name: records[0].get('u').properties.name },
        channel: { id: records[0].get('c').properties.id, name: records[0].get('c').properties.name },
        description: record.get('f').properties.description,
        edited: record.get('f').properties.edited,
        // file: record.get('f').properties.file,
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

module.exports = recordRoutes;
