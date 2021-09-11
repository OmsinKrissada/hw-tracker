## Requirements

-   Node JS (v16 and above)
-   MySQL access (optional but recommended)

## Installation

Create a file name `config.yml` in the same directory as `package.json` using the following template:

```yml
#
# Important:
# *** You need to restart the bot for modifications to take effect. ***
#

# Discord bot token obtainable from https://discord.com/developers/
token: discord bot token here

#
# Enable reminder to be sent when deadline is about to hit
#
# Whether to remind 1 hour before deadline
remind1hr: true
# Whether to remind 10 minutes before deadline
remind10m: true
# Whether to remind 5 minutes before deadline
remind5m: true

# The bot will send reminders to this Guild ID **Do not remove quote symbol
guildId: "guild id here"
# The bot will send reminders to this Channel ID (text channel must be in guild defined above) **Do not remove quote symbol
channelId: "channel id here"

# The bot will mention this role for each reminder. **Do not remove quote symbol
subscriber_role: "role id here"

# GitHub link
source_link: https://github.com/OmsinKrissada/hw-tracker

# Database to be used, must be one of "mysql"/"postgres"/"sqlite"
database: mysql

mysql:
    database: hw_tracker
    hostname: example.com
    port: 3306
    username: hw_tracker
    password: thisisaverystrongpassword

postgres: # Read notice section in README.md
    database: hw_tracker
    hostname: example.com
    port: 5432
    username: hw_tracker
    password: thisisaverystrongpassword

sqlite: # Read notice section in README.md
    dbpath: hw_tracker.db

color:
    red: 0xff0000
    green: 0x04CF8D
    blue: 0x28BAD4
    yellow: 0xebc934
    light_yellow: 0xffffbf
    aqua: 0x34ebbd
    pink: 0xed37f0

# Web interface for "add" form
web:
    enable: false
    port: 8080
    endpoint: http://127.0.0.1:8080
    jwt_secret: a_jwt_secret

update_commands: true
pause_announce: false
dev_mode: false
```

Create a file name `subjects.json` in the same directory as `package.json` using the following template:
The file shall be an array of subjects.

```json
[
	{
		"subID": "ว00000",
		"name": "ฟิสิกส์",
		"msteam": "",
		"classes": ["1 1 2", "3 7", "4 3"]
	},
	{
		"subID": "ว11111",
		"name": "ชีวะ",
		"msteam": "",
		"classes": ["1 5 2", "5 1", "5 2"]
	}
]
```

Once finish you shall run the following commands

```sh
npm install --production && npm run build
```

then start the bot using

```
npm start
```

## Notice

-   SQLite currently has problem with displaying timezones
-   Postgres has problem syncing relation schema
    (only MySQL is fully support at this moment)
