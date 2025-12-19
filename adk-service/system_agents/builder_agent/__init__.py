"""
Auto-generated __init__.py for builder_agent

This file makes the agent compatible with 'adk eval' by exposing the root agent
as a Python module attribute.
"""

from google.adk.agents import config_agent_utils
import os

_config_path = os.path.join(os.path.dirname(__file__), "root_agent.yaml")
root_agent = config_agent_utils.from_config(_config_path)

class agent:
    """Module-like object to satisfy adk eval's import requirements"""
    root_agent = root_agent
