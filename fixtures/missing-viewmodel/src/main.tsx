import { createBullApp } from "@bull/runtime/react";
import { GreetingView } from "./view/greeting.view";

createBullApp({ root: GreetingView });
