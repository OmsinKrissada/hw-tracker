# User

### Format

```json
{
    "id": string,
    "nickname": string,
    "email": string,
    "discord_id": string,
    "created_at": Date,
    "updated_at": Date,
}
```

### Explanation

| Property     | Detail                                           |
| ------------ | ------------------------------------------------ |
| `id`         | `string` User ID                                 |
| `nickname`   | `string` Nickname assigned explicitly by Omsin   |
| `email`      | `string` User email                              |
| `discord_id` | `string` Discord ID (if registered with Discord) |
| `created_at` | `Date` Account creation date                     |
| `updated_at` | `Date` When the user was updated in the database |
