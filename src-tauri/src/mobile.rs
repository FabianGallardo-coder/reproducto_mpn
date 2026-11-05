use serde::Serialize;
use serde_json::Value;
use tauri::{
    plugin::{Builder, PluginHandle, TauriPlugin},
    Manager, State, Wry,
};

struct Mobile(PluginHandle<Wry>);

#[derive(Serialize)]
struct Request {
    command: String,
    args: Value,
}

#[tauri::command]
async fn mobile_command(
    state: State<'_, Mobile>,
    command: String,
    args: Option<Value>,
) -> Result<Value, String> {
    let response = state
        .0
        .run_mobile_plugin_async::<Value>("execute", Request { command, args: args.unwrap_or(serde_json::json!({})) })
        .await
        .map_err(|error| {
            log::error!("Android command failed: {error}");
            error.to_string()
        })?;
    response.get("value").cloned().ok_or_else(|| {
        log::error!("Android returned no command result");
        "Android returned no command result".to_string()
    })
}

fn media_plugin() -> TauriPlugin<Wry> {
    Builder::new("media")
        .setup(|app, api| {
            let handle = api.register_android_plugin("com.flowplayer.app", "MediaPlugin")?;
            app.manage(Mobile(handle));
            Ok(())
        })
        .build()
}

pub fn run() {
    if let Err(error) = tauri::Builder::default()
        .plugin(media_plugin())
        .invoke_handler(tauri::generate_handler![mobile_command])
        .run(tauri::generate_context!())
    {
        log::error!("FlowPlayer Android could not start: {error}");
        panic!("FlowPlayer Android could not start: {error}");
    }
}
