# Homework Resource

## Get all homework

### HTTP Request

```
GET /homeworks
```

#### Query String Parameters:

| Field         | Type                 | Detail                                                         |
| ------------- | -------------------- | -------------------------------------------------------------- |
| `includeUser` | `boolean` (optional) | whether to include `author` field in the response _(optional)_ |
| `withDeleted` | `boolean`            | whether to include deleted/expired homework _(optional)_       |

### Response

**`200 OK`**

```json
[
	{
		"id": number,
		"subID": string,
		"title": string,
		"authorId": string,
		"author": User,
		"createdAt": Date,
		"deletedAt": Date,
		"dueDate": Date,
		"detail": string
	},
	...
]
```

#### Explanation:

| Property    | Detail                                                                             |
| ----------- | ---------------------------------------------------------------------------------- |
| `id`        | `number` Homework ID                                                               |
| `subID`     | `string` Associated subject ID                                                     |
| `title`     | `string` Homework title                                                            |
| `authorId`  | `string` ID of user who created this homework                                      |
| `author`    | [`User`](/guide/user) User who created this homework (only include when requested) |
| `createdAt` | `Date` Creation date                                                               |
| `deletedAt` | `Date \| null` Deletion date                                                       |
| `dueDate`   | `Date \| null` When this homework should be dued                                   |
| `detail`    | `string \| null` Detail explaning this homework                                    |

<br>

## Get single homework

### HTTP Request

```
GET /homeworks/{id}
```

#### Query String Parameters:

| Field         | Detail                                                                   |
| ------------- | ------------------------------------------------------------------------ |
| `includeUser` | `boolean` whether to include `author` field in the response _(optional)_ |

### Response

**`200 OK`**

```json
{
	"id": number,
	"subID": string,
	"title": string,
	"authorId": string,
	"author": User,
	"createdAt": Date,
	"deletedAt": Date,
	"dueDate": Date,
	"detail": string
}
```

#### Explanation:

| Property    | Detail                                                                             |
| ----------- | ---------------------------------------------------------------------------------- |
| `id`        | `number` Homework ID                                                               |
| `subID`     | `string` Associated subject ID                                                     |
| `title`     | `string` Homework title                                                            |
| `authorId`  | `string` ID of user who created this homework                                      |
| `author`    | [`User`](/guide/user) User who created this homework (only include when requested) |
| `createdAt` | `Date` Creation date                                                               |
| `deletedAt` | `Date \| null` Deletion date                                                       |
| `dueDate`   | `Date \| null` When this homework should be dued                                   |
| `detail`    | `string \| null` Detail explaning this homework                                    |

<br>

## Create homework

::: warning
Authorization required!
:::

### HTTP Request

```
POST /homeworks
```

#### Body Parameters:

| Field     | Detail                                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| `title`   | `string` Homework title                                                                                           |
| `subject` | `string` Subject ID                                                                                               |
| `detail`  | `string` _(optional)_ Homework detail (max at 300 characters)                                                     |
| `dueDate` | `string` _(optional)_ Date string conforming to [ISO8601](https://en.wikipedia.org/wiki/ISO_8601) format standard |

### Response

**`201 Created`**

```json
{
	"id": number,
	"subID": string,
	"title": string,
	"authorId": string,
	"createdAt": Date,
	"deletedAt": Date,
	"dueDate": Date,
	"detail": string
}
```

#### Explanation:

| Property    | Detail                                           |
| ----------- | ------------------------------------------------ |
| `id`        | `number` Homework ID                             |
| `subID`     | `string` Associated subject ID                   |
| `title`     | `string` Homework title                          |
| `authorId`  | `string` ID of user who created this homework    |
| `createdAt` | `Date` Creation date                             |
| `deletedAt` | `Date \| null` Deletion date                     |
| `dueDate`   | `Date \| null` When this homework should be dued |
| `detail`    | `string \| null` Detail explaning this homework  |

<br>

## Modify homework

::: warning
Authorization required!
:::

### HTTP Request

```
PATCH /homeworks/{id}
```

#### Body Parameters:

| Field     | Detail                                                                                                            |
| --------- | ----------------------------------------------------------------------------------------------------------------- |
| `title`   | `string` _(optional)_ Homework title                                                                              |
| `subject` | `string` _(optional)_ Subject ID                                                                                  |
| `detail`  | `string` _(optional)_ Homework detail (max at 300 characters)                                                     |
| `dueDate` | `string` _(optional)_ Date string conforming to [ISO8601](https://en.wikipedia.org/wiki/ISO_8601) format standard |

### Response

**`200 OK`**

```json
{
	"id": number,
	"subID": string,
	"title": string,
	"authorId": string,
	"createdAt": Date,
	"deletedAt": Date,
	"dueDate": Date,
	"detail": string
}
```

#### Explanation:

| Property    | Detail                                           |
| ----------- | ------------------------------------------------ |
| `id`        | `number` Homework ID                             |
| `subID`     | `string` Associated subject ID                   |
| `title`     | `string` Homework title                          |
| `authorId`  | `string` ID of user who created this homework    |
| `createdAt` | `Date` Creation date                             |
| `deletedAt` | `Date \| null` Deletion date                     |
| `dueDate`   | `Date \| null` When this homework should be dued |
| `detail`    | `string \| null` Detail explaning this homework  |

<br>

## Delete homework

::: warning
Authorization required!
:::

### HTTP Request

```
DELETE /homeworks/{id}
```

### Response

**`200 OK`**

```json
{
	"id": number,
	"subID": string,
	"title": string,
	"authorId": string,
	"createdAt": Date,
	"deletedAt": Date,
	"dueDate": Date,
	"detail": string
}
```

#### Explanation:

| Property    | Detail                                           |
| ----------- | ------------------------------------------------ |
| `id`        | `number` Homework ID                             |
| `subID`     | `string` Associated subject ID                   |
| `title`     | `string` Homework title                          |
| `authorId`  | `string` ID of user who created this homework    |
| `createdAt` | `Date` Creation date                             |
| `deletedAt` | `Date \| null` Deletion date                     |
| `dueDate`   | `Date \| null` When this homework should be dued |
| `detail`    | `string \| null` Detail explaning this homework  |

<br>
