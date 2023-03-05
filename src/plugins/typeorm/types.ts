import type { Plugin, PluginAction } from "../../container/plugin";
import type { DataSource } from "typeorm";
import type { StorytellerHookDefinition } from "../storyteller/types";
import type { TYPEORM_PLUG } from "./name";
import type { Status, ValueObject } from "../../container/value-object";

export enum TypeormHookName {}

export type TypeormHookDefinition = never;

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
