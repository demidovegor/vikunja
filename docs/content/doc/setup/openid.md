---
date: "2022-08-09:00:00+02:00"
title: "OpenID"
draft: false
type: "doc"
menu:
  sidebar:
    parent: "setup"
---

# OpenID

Vikunja allows for authentication with an external identity source such as Authentik, Keycloak or similar via the
[OpenID Connect](https://openid.net/developers/specs/) standard.

{{< table_of_contents >}}

## OpenID Connect Overview

OpenID Connect is a standardized identity layer built on top of the more generic OAuth 2.0 specification, simplying interaction between the involved parties significantly.
While the [OpenID specification](https://openid.net/specs/openid-connect-core-1_0.html#Overview) is worth a read, we summarize the most important basics here.

The involved parties are:

- **Resource Owner:** typically the end-user
- **Resource Server:** the application server handling requests from the client, the Vikunja API in our case
- **Client:** the application or client accessing the RS on behalf of the RO. Vikunja web frontend or any of the apps
- **Authorization Server:** the server verifying the user identity and issuing tokens. These docs also use the words `OAuth 2.0 provider`, `Identity Provider` interchangeably.

After the user is authenticated, the provider issues a token to the user, containing various claims.
There's different types of tokens (ID token, access token, refresh token), and all of them are created as [JSON Web Token](https://www.rfc-editor.org/info/rfc7519).
Claims in turn are assertions containing information about the token bearer, usually the user.

**Scopes** are requested by the client when redirecting the end-user to the Authorization Server for authentication, and indirectly control which claims are included in the resulting tokens.
There's certain default scopes, but its also possible to define custom scopes, which are used by the feature assigning users to Teams automatically.

## Configuring OIDC Authentication

To achieve authentication via an external provider, it is required to (a) configure a confidential Client on your OAuth 2.0 provider and (b) configure Vikunja to authenticate against this provider. 
[Example configurations]({{< ref "openid-examples.md">}}) are provided for various different identity providers, below you can find generic guides though.

OpenID Connect defines various flow types indicating how exactly the interaction between the involved parties work, Vikunja makes use of the standard **Authorization Code Flow**.

### Step 1: Configure your Authorization Server

The first step is to configure the Authorization Server to correctly handle requests coming from Vikunja.
In general, this involves the following steps at a minimum:

- Create a confidential client and obtain the client ID and client secret
- Configure (whitelist) redirect URLs that can be used by Vikunja
- Make sure the required scopes (`openid profile email` are the default scopes used by Vikunja) are supported
- Optional: configure an additional scope for automatic team assignment, see below for details

More detailled instructions for various different identity providers can be [found here]({{< ref "openid-examples.md">}})

### Step 2: Configure Vikunja

Vikunja has to be configured to use the identity provider. Please note that there is currently no option to configure these settings via environment variables, they have to be defined using the configuration file. The configuration schema is as follows:

```yaml
auth:
  openid:
    enabled: true
    redirecturl: https://vikunja.mydomain.com/auth/openid/  <---- slash at the end is important
    providers:
      - name: <provider-name>
        authurl: <auth-url>
        clientid: <vikunja client-id>
        clientsecret: <vikunja client-secret>
        scope: openid profile email
```

The values for `authurl` can be obtained from the Metadata of your provider, while `clientid` and `clientsecret` are obtained when configuring the client.
The scope usually doesn't need to be specified or changed, unless you want to configure the automatic team assignment.

Optionally it is possible to disable local authentication and therefore forcing users to login via OpenID connect:

```yaml
auth:
  local:
    enabled: false
```

## Automatically assign users to teams

Vikunja is capable of automatically adding users to a team based on OIDC claims added by the identity provider.
If configured, Vikunja will sync teams, automatically create new ones and make sure the members are part of the configured teams.
Teams which exist only because they were created from oidc attributes are not editable in Vikunja.

To distinguish between teams created in Vikunja and teams generated automatically via oidc, generated teams have an `oidcID` assigned internally.
Within the UI, the teams created through OIDC get a `(OIDC)` suffix to make them distinguishable from locally created teams.

On a high level, you need to make sure that the **ID token** issued by your identity provider contains a `vikunja_groups` claim, following the structure defined below.
It depends on the provider being used as well as the preferences of the administrator how this is achieved.
Typically you'd want to request an additional scope (e.g. `vikunja_scope`) which then triggers the identity provider to add the claim.
If the `vikunja_groups` is part of the **ID token**, Vikunja will  start the procedure and import teams and team memberships.

The claim structure expexted by Vikunja is as follows:

```json
{
    "vikunja_groups": [
        {
            "name": "team 1",
            "oidcID": 33349
        },
        {
            "name": "team 2",
            "oidcID": 35933
        }
    ]
}
```

For each team, you need to define a team `name` and an `oidcID`, where the `oidcID` can be any string with a length of less than 250 characters.
The `oidcID` is used to uniquely identify the team, so please make sure to keep this unique.

Below you'll find two example implementations for Authentik and Keycloak.
If you've successfully implemented this with another identity provider, please let us know and submit a PR to improve the docs.

### Setup in Authentik

To configure automatic team management through Authentik, we assume you have already [set up Authentik]({{< ref "openid-examples.md">}}#authentik) as an OIDC provider for authentication with Vikunja.

To use Authentik's group assignment feature, follow these steps:

1. Edit [your config]({{< ref "config.md">}}) to include the following scopes: `openid profile email vikunja_scope`
2. Open `<your authentik url>/if/admin/#/core/property-mappings`
3. Create a new property mapping called `vikunja_scope` as scope mapping. There is a field `expression` to enter python expressions that will be delivered with the oidc token.
4. Write a small script like the following to add group information to `vikunja_scope`:

```python
groupsDict = {"vikunja_groups": []}
for group in request.user.ak_groups.all():
  groupsDict["vikunja_groups"].append({"name": group.name, "oidcID": group.num_pk})
return groupsDict
```

5. In Authentik's menu on the left, go to Applications > Providers > Select the Vikunja provider. Then click on "Edit", on the bottom open "Advanced protocol settings", select the newly created property mapping under "Scopes". Save the provider.

Now when you log into Vikunja via Authentik it will show you a list of scopes you are claiming.
You should see the description you entered on the OIDC provider's admin area.

Proceed to vikunja and open the teams page in the sidebar menu.
You should see "(OIDC)" written next to each team you were assigned through OIDC.

### Setup in Keycloak

The kind people from Makerspace Darmstadt e.V. have written [a guide on how to create a mapper for Vikunja here](https://github.com/makerspace-darmstadt/keycloak-vikunja-mapper).

## Use cases

All examples assume one team called "Team 1" to be configured within your provider.

* *Token delivers team.name +team.oidcID and Vikunja team does not exist:* \
New team will be created called "Team 1" with attribute oidcID: "33929"

2. *In Vikunja Team with name "team 1" already exists in vikunja, but has no oidcID set:* \
new team will be created called "team 1" with attribute oidcID: "33929"

3. *In Vikunja Team with name "team 1" already exists in vikunja, but has different oidcID set:* \
new team will be created called "team 1" with attribute oidcID: "33929"

4. *In Vikunja Team with oidcID "33929" already exists in vikunja, but has different name than "team1":* \
new team will be created called "team 1" with attribute oidcID: "33929"

5. *Scope vikunja_scope is not set:* \
nothing happens

6. *oidcID is not set:* \
You'll get error.
Custom Scope malformed
"The custom scope set by the OIDC provider is malformed. Please make sure the openid provider sets the data correctly for your scope. Check especially to have set an oidcID."

7. *In Vikunja I am in "team 3" with oidcID "", but the token does not deliver any data for "team 3":* \
You will stay in team 3 since it was not set by the oidc provider

8. *In Vikunja I am in "team 3" with oidcID "12345", but the token does not deliver any data for "team 3"*:\
You will be signed out of all teams, which have an oidcID set and are not contained in the token.
Especially if you've been the last team member, the team will be deleted.