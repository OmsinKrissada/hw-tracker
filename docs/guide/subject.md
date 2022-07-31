# Subject Resource

Subject is a school subject from our given timetable.

## Get subjects

### HTTP Request

```
GET /subjects
```

### Response

```json
[
	{
		"subID": string,
		"name": string,
		"classes": [
			{
				"DoW": number,
				"period": number,
				"span": number
			},
			...
		]
	},
	...
]
```

### Explanation

| Property         | Detail                                               |
| ---------------- | ---------------------------------------------------- |
| `subID`          | `string` Subject ID                                  |
| `name`           | `string` Subject Name                                |
| `classes.DoW`    | `number` Date of Week from Monday to Friday (1-5)    |
| `classes.period` | `number` The period perticular class beings at (1-8) |
| `classes.span`   | `number` Length of particular class                  |
