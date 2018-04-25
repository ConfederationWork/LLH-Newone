const Social = require('../../base/Social.js');
const { Canvas } = require('canvas-constructor');
const snek = require('snekfetch');
const fsn = require('fs-nextra');

const getWanted = async (person) => {
  const plate = await fsn.readFile('./assets/images/plate_wanted.jpg');
  const png = person.replace(/\.gif.+/g, '.png');
  const { body } = await snek.get(png);
  return new Canvas(400, 562)
    .setColor('#000000')
    .addRect(0, 0, 400, 562)
    .addImage(plate, 0, 0, 400, 562)
    .addImage(body, 86, 178, 228, 228)
    .toBuffer();
};

class Wanted extends Social {
  constructor(client) {
    super(client, {
      name: 'wanted',
      description: 'Post a wanted picture of a user.',
      category: 'Fun',
      usage: 'wanted [@mention|user id]',
      extended: 'Mention another user to post a wanted poster of them.',
      cost: 5,
      botPerms: ['SEND_MESSAGES', 'ATTACH_FILES'],
    });
  }
  async run(message, args, level) {
    try {
      let wanted;
      if (!args[0]) wanted = message.member;
      else wanted = await this.verifyMember(message.guild, args[0]);
  
      const cost = this.cmdDis(this.help.cost, level);

      const payMe = await this.cmdPay(message, message.author.id, cost, this.conf.botPerms);
      if (!payMe) return;

      const msg = await message.channel.send('Fetching the Sheriff...');
  
      const result = await getWanted(wanted.user.displayAvatarURL);
      await message.channel.send({ files: [{ attachment: result, name: 'wanted.jpg' }] });
     
      await msg.delete();
    } catch (error) {
      throw error;
    }
  }
}

module.exports = Wanted;