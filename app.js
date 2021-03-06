var express = require('express');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var slack = require('./apis/slack');
var axios = require('axios');

var app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

let MERGE_TS_TABLE = {};

const debug = (message, type) => {
  let d = new Date();
  console.log(`[${d.toLocaleString()} ${type.toUpperCase()}] ${message}`);
};

const triggerPipeline = (projectId, branch, token) => {
  const triggerPath = `http://10.137.5.204:8088/api/v4/projects/${projectId}/ref/${branch}/trigger/pipeline?token=${token}`;
  return axios.post(triggerPath);
};

app.post('/gitlab', async function(req, res, next) {
  let action = req.get('X-Gitlab-Event');
  let body = req.body
  let message = ""
  let d = new Date();

  if (action == 'System Hook') {

    if ('event_name' in body) {

      if (/project_/.test(body.event_name)) {
        message = `${body.path_with_namespace} ${body.event_name}`;
      }
      else if (/group_/.test(body.event_name)) {
        message = `${body.name} ${body.event_name}`;
      }
      else if (/user_*_team/.test(body.event_name)) {
        message = `${body.project_path_with_namespace} ${body.user_username} ${body.event_name}`;
      }
      else if (/user_/.test(body.event_name)) {
        message = `${body.username} ${body.event_name}`;
      }
      else if (body.event_name === 'push') {
        message = `${body.user_name} ${body.event_name} to ${body.project.path_with_namespace}`;
      }
      else if (body.event_name === 'repository_update') {
        message = `${body.project.path_with_namespace} ${body.event_name} by ${body.user_name}`;
      }
      else {
        message = `${body.event_name}`;
      }

      debug(message, action);
    }
  }
  else if ('object_kind' in body){
    let channel;
    let token;
    let username;
    let projectName;

    let logMessage = '';

    if (req.query.channel) {
      channel = req.query.channel;
    }

    if (req.query.trigger) {
      token = req.query.trigger;
    }

    if (body.object_kind === 'merge_request') {
      const projectId = body.project.id;
      const branch = body.object_attributes.source_branch;
      const action = body.object_attributes.action;

      message = `${body.user.name} (${body.user.username}) <${body.object_attributes.url}|${action} merge request !${body.object_attributes.iid}> in <${body.project.web_url}|${body.project.path_with_namespace}>`;

      if (action && channel) {
        const tsKey = `${projectId}_${body.object_attributes.iid}`;

        try{
          MERGE_TS_TABLE[tsKey] = await slack.getMessageThreadId(channel, `open merge request !${body.object_attributes.iid}>`);

          const res = await slack.send(message, channel, [
            {
              text: `${body.object_attributes.iid} ${body.object_attributes.title}`,
              color: '#000000',
            }
          ], MERGE_TS_TABLE[tsKey]);

          if (!MERGE_TS_TABLE[tsKey]) {
            MERGE_TS_TABLE[tsKey] = res.ts;
          }

          if (token) {
            if (token && (action === 'open' ||
                (action === 'update' && body.changes && Object.keys(body.changes).length === 0))) {
              debug(`${body.project.path_with_namespace}/${branch}`, 'trigger');
              await triggerPipeline(projectId, branch, token);
              await slack.send(`Success to trigger pipeline in ${body.project.path_with_namespace}/${branch}`, channel, undefined, MERGE_TS_TABLE[tsKey]);
            }
          }
        }
        catch (err) {
          console.log(err);
        }
      }
    }
    else if (body.object_kind === 'note') {
      if ('merge_request' in body) {
        const tsKey = `${body.project.id}_${body.merge_request.iid}`;

        message = `${body.user.name}(${body.user.username}) <${body.merge_request.url}|commented on merge request !${body.merge_request.iid}> `;
        message += `in <${body.project.web_url}|${body.project.path_with_namespace}>: *${body.merge_request.title}* `;

        if (channel) {
          try {
            MERGE_TS_TABLE[tsKey] = await slack.getMessageThreadId(channel, `open merge request !${body.merge_request.iid}>`);

            const res = await slack.send(message, channel, [
              {
                text: `${body.object_attributes.note}`,
                color: '#000000',
              }
            ], MERGE_TS_TABLE[tsKey]);

            if (!MERGE_TS_TABLE[tsKey]) {
              MERGE_TS_TABLE[tsKey] = res.ts;
            }
          }
          catch(err) {
            console.log(err);
          }
        }
      }
      else if ('issue' in body) {
        message = `${body.user.name}(${body.user.username}) `;
        message += `<${body.issue.url}|commented on issue #${body.issue.iid}> `;
        message += `in <${body.project.web_url}|${body.project.path_with_namespace}>: *${body.issue.title}* `;

        if (channel) {
          try {
            await slack.send(message, channel, [
              {
                text: `${body.object_attributes.note}`,
                color: '#000000',
              }
            ]);
          }
          catch (err) {
            console.log(err);
          }
        }
      }
    }
  }

  res.json({
    rv: 'success',
  });
})

app.listen(3000, function () {
  debug('Listening on port 3000!', 'SYSTEM');

  slack.send("Webhooks service is Up !", undefined, [
    {
      text: `上線時間${(new Date()).toLocaleString()}`,
      color: '#000000',
    }
  ]);
});
