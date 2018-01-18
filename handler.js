'use strict';
const moment = require('moment');
const PromisePool = require('es6-promise-pool');
const AWS = require('aws-sdk');

const s3 = new AWS.S3();

const { getRemainingSeats } = require('./lib/api');

const DAYS = 31;

const generatePromises = function* () {
	for (let i = 0; i < DAYS; i++) {
		const date = moment().add(i, 'days');
		yield Promise.all([
			getRemainingSeats('Ankara Gar', 'Kars', 234516259, 234517635, date),
			getRemainingSeats('Kars', 'Ankara Gar', 234517635, 234516259, date)
		]);
	}
};



module.exports.run = (event, context) => {
	const startTime = new Date().getTime();
	console.log(`Karsrail started at ${startTime}`);

	const results = [];

	const promiseIterator = generatePromises();
	const pool = new PromisePool(promiseIterator, 6);

	pool.addEventListener('fulfilled', event => {
		const result = event.data.result;
		const ankaraKars = result.find(r => r.to == 'Kars' && r.remainingSeats !== -999);
		const karsAnkara = result.find(r => r.from == 'Kars' && r.remainingSeats !== -999);
		if (ankaraKars && karsAnkara) {
			results.push({ date: ankaraKars.date, trDate: ankaraKars.trDate, ankaraKars: ankaraKars.remainingSeats, karsAnkara: karsAnkara.remainingSeats, availables: { karsAnkara: karsAnkara.availableWagonNumbers || [], ankaraKars: ankaraKars.availableWagonNumbers || []} });
		}
	});

	pool
		.start()
		.then(() => {
			const endTime = new Date().getTime();
			const data = {
				results,
				time: endTime
			};
			return s3.putObject({
				Bucket: process.env.BUCKET,
				Key: 'karsrail.json',
				Body: JSON.stringify(data),
				ACL: 'public-read',
				ContentType: 'application/json'
			}).promise();
		})
		.then(() => {
			console.log(`Karsrail completed at ${new Date().getTime()}`);
		})
		.catch(err => {
			console.error(`Karsrail failed`, err);
		});

};
