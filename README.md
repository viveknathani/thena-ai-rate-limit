# thena AI rate limit setup

Source for throttling on the API client level until we are sure that the system is healthy again.

This system accepts two entities as its parameters
1. `maxErrorCount` -  maximum acceptable errors in our specified time period
2. `windowSizeInSeconds` - the specified time period

