import "@logseq/libs";
import handleListeners from "./utils/handleListeners";
import { callSettings } from "./settings";
import { retrieveTasks } from "./features/retrieve";
import { PluginSettings } from "./settings/types";
import { render } from "preact";
import { SendTask } from "./features/send/components/SendTask";
import { removeTaskFlags, sendTask } from "./features/send";
import {
  getAllProjects,
  getAllLabels,
  getIdFromString,
} from "./features/helpers";

const main = async () => {
  console.log("logseq-todoist-plugin loaded");
  handleListeners();
  const { apiToken } = logseq.settings! as Partial<PluginSettings>;
  if (!apiToken || apiToken === "") {
    // Check if it's a new install
    await logseq.UI.showMsg(
      "Please key in your API key before using the plugin",
      "error",
    );
  }
  const projects = await getAllProjects();
  const labels = await getAllLabels();
  callSettings(projects, labels);

  // RETRIEVE TASKS
  logseq.Editor.registerSlashCommand("Todoist: Retrieve Tasks", async (e) => {
    await retrieveTasks(e.uuid);
  });
  logseq.Editor.registerSlashCommand(
    "Todoist: Retrieve Today's Tasks",
    async (e) => {
      await retrieveTasks(e.uuid, "today");
    },
  );
  logseq.Editor.registerSlashCommand(
    "Todoist: Retrieve Custom Filter",
    async (e) => {
      const content = await logseq.Editor.getEditingBlockContent();
      await retrieveTasks(e.uuid, content);
    },
  );

  // SEND TASKS
  logseq.Editor.registerSlashCommand("Todoist: Send Task", async (e) => {
    const { sendDefaultProject } = logseq.settings! as Partial<PluginSettings>;
    const content: string = await logseq.Editor.getEditingBlockContent();
    if (!content || content.length === 0) {
      await logseq.UI.showMsg("Cannot send empty task", "error");
      return;
    }
    if (
      sendDefaultProject === "--- ---" ||
      !sendDefaultProject ||
      sendDefaultProject === ""
    ) {
      const msg = await logseq.UI.showMsg("Loading projects and tasks");
      logseq.UI.closeMsg(msg);
      // Render popup
      render(
        <SendTask
          projects={projects}
          labels={labels}
          content={removeTaskFlags(content).trim()}
          uuid={e.uuid}
        />,
        document.getElementById("app") as HTMLElement,
      );
      logseq.showMainUI();
    } else {
      let url = await sendTask(e.uuid, content, getIdFromString(sendDefaultProject));
      let block = await logseq.Editor.getCurrentBlock();
      if (block) {
        let update = content;

        // If the content was a task, mark it as DONE
        const taskFlags = ["TODO", "DOING", "NOW", "LATER", "DONE"];
        for (const f of taskFlags) {
          if (content.includes(f)) {
            // If the block sent to todoist was a task, mark it as done
            update = content.replace(f, "DONE");
            break;
          }
        }

        // Append todoist task link to the block
        if (url) {
          update = `${update} [todoist](${url})`;
        }

        await logseq.Editor.updateBlock(block.uuid, update);
      }
    }
  });
};

logseq.ready(main).catch(console.error);
