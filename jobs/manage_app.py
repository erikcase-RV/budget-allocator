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

headers = {"Authorization": f"Bearer {token}"}

if action == "start":
    resp = requests.post(f"{host}/api/2.0/apps/{app_name}/start", headers=headers)
elif action == "stop":
    resp = requests.post(f"{host}/api/2.0/apps/{app_name}/stop", headers=headers)

if resp.status_code == 200:
    state = resp.json().get("app_status", {}).get("state", "UNKNOWN")
    print(f"Successfully sent '{action}' to app '{app_name}'. Current state: {state}")
else:
    raise Exception(f"Failed to {action} app '{app_name}': {resp.status_code} {resp.text}")
