import Database from "better-sqlite3";
import { SCHEMA_SQL } from "./schema.js";
import { WorkspaceRepository } from "./repositories/workspaceRepo.js";
import { UserRepository } from "./repositories/userRepo.js";
import { EventRepository } from "./repositories/eventRepo.js";
import { MessageRepository } from "./repositories/messageRepo.js";
import { AgentRepository } from "./repositories/agentRepo.js";

export class MuxDatabase {
  public readonly db: Database.Database;
  public readonly workspaces: WorkspaceRepository;
  public readonly users: UserRepository;
  public readonly events: EventRepository;
  public readonly messages: MessageRepository;
  public readonly agents: AgentRepository;

  constructor(dbPath: string = ":memory:") {
    this.db = new Database(dbPath);
    // Enable WAL mode for better concurrency if on disk
    if (dbPath !== ":memory:") {
      this.db.pragma("journal_mode = WAL");
    }
    this.db.pragma("foreign_keys = ON");
    this.initSchema();

    this.workspaces = new WorkspaceRepository(this.db);
    this.users = new UserRepository(this.db);
    this.events = new EventRepository(this.db);
    this.messages = new MessageRepository(this.db);
    this.agents = new AgentRepository(this.db);
  }

  private initSchema(): void {
    this.db.exec(SCHEMA_SQL);
  }

  close(): void {
    this.db.close();
  }
}

export function createDatabase(dbPath?: string): MuxDatabase {
  return new MuxDatabase(dbPath);
}
