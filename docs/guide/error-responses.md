# Error Responses

Error can be a JSON object or array depending on the circumstances.

This list **does not include** error with status code 500.

**Format**:

```json
{
	"message": string,
	"field": string
}
```

**Explanation**:

| Property | Type                              | Details                                       |
| -------- | --------------------------------- | --------------------------------------------- |
| message  | string                            | Explains what particular error is about       |
| field    | string (only with resource error) | Field in the request body the error refers to |

Here is a list of errors you might encounter

## Request Format Error

Content types must be set according to the [guide](/guide/making-requests.html#content-type).

| HTTP Code | Message                                                       | Triggered By                                                |
| :-------: | ------------------------------------------------------------- | ----------------------------------------------------------- |
|    415    | `only accepts application/json in POST, PUT and PATCH method` | not using `application/json` in Content-Type when necessary |
|    400    | `received malformed JSON`                                     | JSON received cannot be properly parsed                     |

## Authentication Error

| HTTP Code | Message                                                 | Triggered By                                                                                     |
| :-------: | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
|    403    | `user must be explicitly allowed the resource by Omsin` | user not having access permission from Omsin, you can contact him if you think this is a mistake |
|    401    | `jwt: <jwt message>`                                    | invalid jwt token                                                                                |

## Resource Error

The response should be self-explanatory.
