import { createBullApp } from "@bull-js/runtime/react";
import { GreetingView } from "./view/greeting.view";

createBullApp({ root: GreetingView });
