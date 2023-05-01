import type { Plugin, PluginAction } from "../../container/plugin";
import type { DataSource } from "typeorm";
import type { StorytellerHookDefinition } from "../storyteller/types";
import type { TYPEORM_PLUG } from "./name";
import type { Status, ValueObject } from "../../container/value-object";
import type { HookDefinition } from "../../container/hook";
import type { QueryRunner } from "typeorm";
export enum TypeormHookName {
  chainAppended = "chainAppended",
  ormLogged = "ormLogged",
}

export type TypeormHookDefinition =
  | HookDefinition<TypeormHookName.chainAppended, {}>
  | HookDefinition<
      TypeormHookName.ormLogged,
      (
        | { name: "log"; query: string; parameters?: any[] }
        | { name: "logMigration"; message: string }
        | { name: "logQuery"; query: string; parameters?: any[] | undefined }
        | { name: "logQueryError"; error: string | Error; query: string; parameters?: any[] | undefined }
        | { name: "logQuerySlow"; time: number; query: string; parameters?: any[] | undefined }
        | { name: "logSchemaBuild"; message: string }
      ) & { dataSourceName: string; queryRunner?: QueryRunner }
    >;

export interface TypeormDataSource<TDataSourceName extends string> {
  name: TDataSourceName;
  dataSource: DataSource;
}

export interface TypeormChainElement {
  name: string;
  args: any[];
}

export interface TypeormState<TDataSourceName extends string> {
  globalState: {
    dataSources: TypeormDataSource<TDataSourceName>[];
  };
  dataSourceChains: { name: TDataSourceName; chains: TypeormChainElement[] }[];
}

export interface TypeormActions<TDataSourceName extends string> extends PluginAction<any, any, any> {
  typeormGetManager: (payload: { name: TDataSourceName }) => DataSource["manager"];
  typeormGetChains: (payload: { name: TDataSourceName }) => TypeormChainElement[][];
}

export type TypeormPlugin<TDataSourceName extends string> = Plugin<
  typeof TYPEORM_PLUG,
  TypeormState<TDataSourceName>,
  TypeormActions<TDataSourceName>,
  TypeormHookDefinition | StorytellerHookDefinition
>;

export type TypeormValueObject<TDataSourceName extends string> = ValueObject<
  Status.forged,
  TypeormHookDefinition | StorytellerHookDefinition,
  TypeormPlugin<TDataSourceName>
>;
