const Command = require('../../base/Command.js');

class Reload extends Command {
  constructor(client) {
    super(client, {
      name: 'reload',
      description: 'Reloads a command that has been modified.',
      category: 'System',
      usage: 'reload [command]',
      extended: 'This command is designed to unload, then reload the command from the command & aliases collections for the changes to take effect.',
      botPerms: ['SEND_MESSAGES'],
      permLevel: 'Bot Admin'
    });
  }

  async run(message, args, level) { // eslint-disable-line no-unused-vars
    if (!args || args.size < 1) return message.reply('Must provide a command to reload. Derp.');
    const commands = this.client.commands.get(args[0]);
    
    let response = await this.client.unloadCommand(`${commands.conf.location}`, args[0]);
    if (response) return message.reply(`Error Unloading: ${response}`);
    
    response = this.client.loadCommand(`${commands.conf.location}`, args[0]);
    if (response) return message.reply(`Error loading: ${response}`);
    
    message.reply(`The command \`${args[0]}\` has been reloaded`);
  }
}

module.exports = Reload;
