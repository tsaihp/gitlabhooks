const slack = require('../slack');

test('Send message', async () => {
  let res = await slack.send('Test to send message.');
  expect(res.ok).toBeTruthy();

  res = await slack.send('Test to send message to exist channel.', 'test_channel');
  expect(res.ok).toBeTruthy();

  try {
    res = await slack.send('Test to send message to non-exist channel.', 'test_channel_not_exist');
  }
  catch (e) {
    expect(e.ok).toBeFalsy();
  }
});

test('Get channel messages', async () => {
  let messages = await slack.getChannelMessages('test_channel', 10);
  expect(messages.length).toBeGreaterThan(0);
});

test('Get thread id of channel message', async () => {
  let threadId = await slack.getMessageThreadId('test_channel', 'Webhooks service is Up !');
  expect(threadId).not.toEqual(undefined);
});
