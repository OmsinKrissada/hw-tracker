## Installation

Create a file name `config.yml` in the same directory as `package.json` using the following template:

```yml
#
# Note:
# You need to restart the bot for modifications to take effect.
#

token: discord bot token here
guildId: "guild id here"
channelId: "channel id here"

subscriber_role: "role id here"
source_link: https://github.com/OmsinKrissada/hw-tracker

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

update_commands: true
pause_announce: false
dev_mode: false
```

## Notice

-   SQLite currently has problem with displaying timezones
-   Postgres has problem syncing relation schema
    (only MySQL is fully support at this moment)
