# Share GaitSense through MongoDB Atlas

MongoDB Compass is a client, not a hosting service. A connection to
`127.0.0.1:27017` is reachable only from the same computer. Use MongoDB Atlas to give
teammates controlled cloud access.

## 1. Create the cloud deployment

1. Sign in at <https://cloud.mongodb.com/>.
2. Create a project named `GaitSense`.
3. Create an `M0` Free cluster for development.
4. Choose a nearby free region and name the cluster `gaitsense-dev`.
5. Under **Security > Database & Network Access**, add your current IP address.

Do not use `0.0.0.0/0` as a permanent IP access rule. Add each teammate's current IP,
or use an approved private-network configuration when the project matures.

## 2. Create temporary migration access

In **Database & Network Access > Database Users**, create a temporary SCRAM user with
the **Atlas admin** role. Atlas requires this level for the full validator/index
bootstrap and verification. Use a generated password and do not commit the connection
string.

From the cluster's **Connect > Shell** page, copy the `mongodb+srv://...` connection
string and substitute the temporary user's password. Percent-encode special characters
in URI passwords.

## 3. Apply and verify the GaitSense schema

In PowerShell, from the `database` directory:

```powershell
$env:MONGO_DATABASE = "gaitsense"
$env:SKIP_APP_USER_CREATION = "true"
$atlasAdminUri = "mongodb+srv://TEMP_ADMIN:URL_ENCODED_PASSWORD@YOUR_CLUSTER.mongodb.net/admin?retryWrites=true&w=majority"

mongosh $atlasAdminUri --file .\mongo\bootstrap.js
mongosh $atlasAdminUri --file .\mongo\verify.js

Remove-Item Env:SKIP_APP_USER_CREATION
$atlasAdminUri = $null
```

The verification command should report 16 collections, validators, indexes, seeds,
and 13 valid insert paths.

## 4. Replace the migration account

After verification:

1. Delete the temporary Atlas admin database user.
2. Create a backend user with `readWrite` access only to the `gaitsense` database.
3. Create a separate, named database user for each teammate who needs Compass access.
4. Add each teammate's current IP to the project IP access list.
5. Never post a shared database password in GitHub, chat, or documentation.

Atlas application users and database users are different:

- Invite teammates under **Project Identity & Access** so they can use the Atlas UI.
- Create database users under **Database & Network Access** so Compass and applications
  can query MongoDB.

## 5. Connect MongoDB Compass

For each teammate:

1. In Atlas, open the cluster and select **Connect > Compass**.
2. Copy the generated `mongodb+srv://...` connection string.
3. In Compass, click **Add new connection**.
4. Paste the string, enter that teammate's database-user password, and save it locally.

Do not commit an Atlas connection string containing credentials. The backend should
read it from a local `.env` file or a deployment secret manager.

## Later migration of real data

The current database contains only schema and catalog seeds, so running `bootstrap.js`
is sufficient. Once real users or gait sessions exist, migrate with the official
MongoDB Database Tools (`mongodump` and `mongorestore`) during a write-free maintenance
window; Atlas database users and roles must be recreated separately.

