const axios = require('axios');

const SLACK_TOKEN = process.env.SLACK_TOKEN ? process.env.SLACK_TOKEN : undefined;
const AS_NAME = '小助理';
const ICON_URL = 'https://avatars.slack-edge.com/2017-11-22/276988224758_f2a72ff5a1ad0a09a559_48.jpg';
const DEFAULT_CNAHHEL = 'test_channel';
const MESSAGES_SEARCH_COUNT = 500;
const DEBUG_ENABLED = process.env.debug ? process.env.debug.split(' ').find(el => el === 'slack') !== undefined : false;

const SLACK_API = (api) => `https://slack.com/api/${api}`;

var CHANNEL_LIST = {};

const debug = (message, action, error) => {
  if (DEBUG_ENABLED) {
    let debugMsg = `[${(new Date()).toLocaleString()} Slack Hook] (${action}) ${message}`;

    if (error) {
      debugMsg += 'fail!!';
      console.log(error);
    }

    console.log(debugMsg);
  }
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
    debug(message, 'send', err);
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
      debug(`id of ${channel}`, 'getChannelId',err);
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
      debug(`messages. (${res.data.error})`, 'getChannelMessages', res.data.error);
      reject(res.data.error);
    }
  }
  catch(err) {
    debug(`messages in ${channel}`, 'getChannelMessages', err);
    reject(err);
  }
});

const getMessageThreadId = (channel, searchMsg) => new Promise( async (resolve, reject) => {
  try {
    const messages = await getChannelMessages(channel, MESSAGES_SEARCH_COUNT);
    const foundMsg = messages.find(el => {
      if (el.type === 'message'
          && el.text
          && el.text.includes(searchMsg)) {
        return true;
      }
      else {
        return false;
      }
    });

    if (foundMsg) {
      resolve(foundMsg.ts);
    }
    else {
      reject(undefined);
    }
  }
  catch(err) {
    debug(`thread id`, 'getMessageThreadId', err);
  }
});

exports.send = send;
exports.getChannelMessages = getChannelMessages;
exports.getMessageThreadId = getMessageThreadId;

// Check
if (!SLACK_TOKEN) {
  console.log('Please set env.SLACK_TOKEN first.');
  process.exit(-1);
}
