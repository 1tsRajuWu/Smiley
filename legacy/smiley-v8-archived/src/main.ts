import { AppController } from "./ui/app";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

const boot = document.getElementById("boot");
const app = new AppController(root);

app
  .start()
  .then(() => {
    boot?.remove();
    document.body.classList.add("ready");
  })
  .catch((e) => {
    if (boot) boot.textContent = `Failed: ${e}`;
    document.body.classList.add("ready");
  });
