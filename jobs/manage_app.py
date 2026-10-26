# Databricks notebook source
# COMMAND ----------

# MAGIC %md
# MAGIC # Manage Budget Allocator App
# MAGIC Start or stop the budget-allocator Databricks App.
# MAGIC Set the `action` widget to `start` or `stop`.

# COMMAND ----------

dbutils.widgets.text("action", "stop", "Action (start/stop)")
dbutils.widgets.text("app_name", "budget-allocator", "App Name")

action = dbutils.widgets.get("action")
app_name = dbutils.widgets.get("app_name")

assert action in ("start", "stop"), f"Invalid action: {action}. Must be 'start' or 'stop'."

# COMMAND ----------

import requests
import os

host = dbutils.notebook.entry_point.getDbutils().notebook().getContext().apiUrl().getOrElse(None)
token = dbutils.notebook.entry_point.getDbutils().notebook().getContext().apiToken().getOrElse(None)

assert host, "Could not resolve Databricks workspace URL from notebook context."
assert token, "Could not resolve API token from notebook context. Ensure the job run-as principal has a valid token."

headers = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
}

if action == "start":
    resp = requests.post(f"{host}/api/2.0/apps/{app_name}/start", headers=headers, json={})
elif action == "stop":
    resp = requests.post(f"{host}/api/2.0/apps/{app_name}/stop", headers=headers, json={})

if resp.status_code == 200:
    print(f"Successfully sent '{action}' to app '{app_name}'.")
    print(f"Response: {resp.json()}")
elif resp.status_code == 400 and "ACTIVE" in resp.text and action == "start":
    print(f"App '{app_name}' is already running. No action needed.")
elif resp.status_code == 400 and "STOPPED" in resp.text and action == "stop":
    print(f"App '{app_name}' is already stopped. No action needed.")
else:
    raise Exception(f"Failed to {action} app '{app_name}': {resp.status_code} {resp.text}")
