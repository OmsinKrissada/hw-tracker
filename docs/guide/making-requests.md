# Making Requests

## Endpoint

Requests are made using `GET`, `POST`, `PUT`, or `DELETE` methods to the following URL:

```
https://hw.krissada.com/api
```

## Content Type

If body data are passed, only JSON format is accepted. `Content-Type` header of each request should be set to `application/json`.

**One exception** is file upload which accepts `multipart/form-data`.

Failure to comply results in the destruction of mankind. Just kidding, the server will return an error as pointed out in the following section.
