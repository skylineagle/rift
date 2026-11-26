use clap::{Parser, Subcommand};

#[derive(Parser)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    Pipe {
        a: String,
        b: String,
        #[arg(long, default_value = "adhoc")]
        name: String,
        #[arg(long)]
        log: Option<String>,
        #[arg(long)]
        quiet: bool,
    },
}

fn main() -> rift_core::Result<()> {
    let Command::Pipe { a, b, name, .. } = Cli::parse().command;
    rift_desktop_lib::headless::pipe(name, &a, &b)
}
