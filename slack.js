const axios = require('axios');

const SLACK_TOKEN = process.env.SLACK_TOKEN ? process.env.SLACK_TOKEN : undefined;
const AS_NAME = '小助理';
const ICON_URL = 'https://avatars.slack-edge.com/2017-11-22/276988224758_f2a72ff5a1ad0a09a559_48.jpg';
const DEFAULT_CNAHHEL = 'test_channel';

const SLACK_API = (api) => `https://slack.com/api/${api}`;

var CHANNEL_LIST = {};

const debug = (message, action) => {
  const d = new Date();
  console.log(`[${d.toLocaleString()} Slack Hook] ${action} ${message}`);
};

const send = (message, channel, attachments, toThread) => new Promise( async (resolve, reject) => {
  let data = {
    text: message,
    channel: DEFAULT_CNAHHEL,
    token: SLACK_TOKEN,
    username: AS_NAME,
    icon_url: ICON_URL,
    attachments: JSON.stringify(attachments),
  };

  if (channel) {
    data.channel = channel;
  }

  if (toThread !== undefined) {
    data.thread_ts = toThread;
  }

  try {
    const res = await axios({
      url: SLACK_API('chat.postMessage'),
      method: 'post',
      params: data,
    });

    debug(message, 'send');
    resolve(res.data);
  }
  catch(err) {
    debug(message, 'fail to send');
    console.log(err);
    reject(err);
  };
});

const getChannelId = (channel) => new Promise( async (resolve, reject) => {
  if (CHANNEL_LIST[channel]) {
    resolve(CHANNEL_LIST[channel]);
  }
  else {
    const request = {
      url: SLACK_API('channels.list'),
      method: 'get',
      params: {
        token: SLACK_TOKEN,
        exclude_archived: true,
        exclude_members: true,
      },
    };

    try {
      const foundChannel = (await axios(request)).data.channels.find(el => el.name === channel);
      if (foundChannel) {
        CHANNEL_LIST[channel] = foundChannel.id;
        resolve(foundChannel.id);
      }
    }
    catch(err) {
      debug(`id of ${channel}`, 'fail to get');
      reject(err);
    }
  }
});

const getChannelMessages = (channel, count) => new Promise( async (resolve, reject) => {
  try {
    const channelId = await getChannelId(channel);

    let res = await axios({
      url: SLACK_API('channels.history'),
      method: 'get',
      params: {
        token: SLACK_TOKEN,
        channel: channelId,
        count: (count)?count:10,
      },
    });

    if (res.data.ok) {
      resolve(res.data.messages);
    }
    else {
      debug(`messages. (${res.data.error})`, 'fail to get');
      reject(res.data.error);
    }
  }
  catch(err) {
    debug(`messages in ${channel}`, 'fail to get');
    reject(err);
  }
});

// Check
if (!SLACK_TOKEN) {
  console.log('Please set env.SLACK_TOKEN first.');
  process.exit(-1);
}

exports.send = send;
exports.getChannelMessages = getChannelMessages;

// send('ya');
// getChannelMessages('dni-standard')
// .then(res => {
//   res.forEach(el => {
//     if (el.type === "message") {
//       if (el.user) {
//         console.log(`${el.user} (${el.ts}): ${el.text}`);
//       }
//       else if (el.username) {
//         console.log(`${el.username} (${el.ts}): ${el.text}`);
//       }
//     }
//   });
// })
// .catch(err => {

// })
