'use strict';

const path		= require('path');
const app		= require('koa')();
const swig		= require('koa-swig');
const body		= require('koa-buddy');
const router	= require('koa-router')();
const settings	= require('./settings.js');

function findChild(name, children) {
	for (let child of children) {
		if (child.name === name) {
			return child;
		}
	}
}

// Microsoft Outlook / Apple Mail
router.post('/Autodiscover/Autodiscover.xml', function *autodiscover() {
	this.set('Content-Type', 'application/xml');

	const request	= findChild('Request', this.request.body.root.children);
	const schema	= findChild('AcceptableResponseSchema', request.children);
	const email		= findChild('EMailAddress', request.children).content;
	const username	= email.split('@')[0];
	const domain	= email.split('@')[1];

	let template = 'autodiscover'
	if (process.env.SMTP_PROTOCOL == 'STARTTLS') {
		template =  'autodiscovertls'
	}

	yield this.render(template, {
		schema: schema.content,
		email,
		username,
		domain
	});
});

// Thunderbird
router.get('/mail/config-v1.1.xml', function *autoconfig() {
	this.set('Content-Type', 'application/xml');
	yield this.render('autoconfig');
});

// iOS / Apple Mail (/email.mobileconfig?email=username@domain.com)
router.get('/email.mobileconfig', function *autoconfig() {
	const email = this.request.query.email;
	const name = this.request.query.name || email;

	if (!email || !~email.indexOf('@')) {
		this.status = 400;

		return;
	}

	const domain	= email.split('@').pop();
	const filename	= `${domain}.mobileconfig`;

	this.set('Content-Type', 'application/x-apple-aspen-config; chatset=utf-8');
	this.set('Content-Disposition', `attachment; filename="${filename}"`);

	yield this.render('mobileconfig', {
		email,
		name,
		domain
	});
});

app.context.render = swig({
	root: path.join(__dirname, 'views'),
	autoescape: true,
	cache: 'memory',
	ext: 'xml',
	locals: settings
});

app.use(function *fixContentType(next) {
	let type = this.request.headers['content-type'];

	if (type && type.indexOf('text/xml') === 0) {
		let newType = type.replace('text/xml', 'application/xml');

		this.request.headers['content-type'] = newType;
	}

	yield next;
});

app.use(body());
app.use(router.routes());
app.use(router.allowedMethods());

app.listen(process.env.PORT || 8000);
