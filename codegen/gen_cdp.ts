#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import {
    TSType,
    program,
    blockStatement,
    variableDeclaration,
    variableDeclarator,
    importDeclaration as importDecl,
    importNamespaceSpecifier as importNS,
    exportNamedDeclaration as exportNamed,
    identifier as ident,
    arrowFunctionExpression,
    tsTypeAliasDeclaration as typeAlias,
    tsTypeLiteral as typeLit,
    tsPropertySignature as propSig,
    tsTypeAnnotation as typeAnn,
    tsLiteralType as litType,
    tsUnionType as unionType,
    tsTypeReference as typeRef,
    tsArrayType as arrayType,
    tsStringKeyword, tsNumberKeyword, tsBooleanKeyword,
    stringLiteral, numberLiteral, tsAnyKeyword, tsObjectKeyword
} from '@babel/types';
import generate from '@babel/generator';

const mkdirp = path => mkdirSync(path, { recursive: true });

const typesToKWs = {
    'string': tsStringKeyword,
    'binary': tsStringKeyword,
    'number': tsNumberKeyword,
    'integer': tsNumberKeyword,
    'boolean': tsBooleanKeyword,
    'any': tsAnyKeyword,
    'object': tsObjectKeyword
};

export const makeTypeDefn = ({ type, properties, items, $ref, enum: _enum }, importSet): TSType => {
    if (properties) {
        return typeLit(properties.map(prop => {
            const sig = propSig(ident(prop.name), typeAnn(makeTypeDefn(prop, importSet)));
            sig.optional = !!prop.optional;
            return sig
        }));
    } else if (_enum) {
        return unionType(_enum.map(member => litType(stringLiteral(member))));
    } else if ($ref) {
        const names = $ref.split('.');
        if (names.length > 1) importSet.add(names[0]);
        return typeRef(ident($ref));
    } else if (items) {
        return arrayType(makeTypeDefn(items, importSet));
    } else {
        return typesToKWs[type]();
    }
};

export const makeType = (type, importSet) =>
    exportNamed(typeAlias(ident(type.id), null, makeTypeDefn(type, importSet)), []);

export const makeImports = (importSet: Set<string>) => Array.from(importSet).map(source =>
    importDecl([importNS(ident(source))], stringLiteral(`./${source}`)));

export const makeDomainModule = ({ types }) => {
    const importSet: Set<string> = new Set();
    const typeExports = (types ?? []).map(type => makeType(type, importSet));
    const imports = makeImports(importSet);

    return program([
        ...imports,
        ...typeExports
    ]);
};

export const readStdin = () => new Promise<string>((resolve, reject) => {
    const stdin = process.stdin;
    let data = '';
    stdin.on('data', chunk => data += chunk);
    stdin.on('end', () => resolve(data))
    stdin.on('error', reject);
});

export const main = async argv => {
    if (process.stdin.isTTY) {
        console.error('protocol specification required');
        return process.exit(1);
    }

    const protocol = JSON.parse(await readStdin());
    const targetDir = join(argv.outputDir, 'src');
    mkdirp(targetDir);

    protocol.domains.forEach(domain => {
        const domainModule = makeDomainModule(domain);
        const { code: generatedCode } = generate(domainModule)
        writeFileSync(join(targetDir, `${domain.domain}.ts`), generatedCode);
    });
};

main(yargs(hideBin(process.argv))
    .command('$0 <output-dir>', 'Generate the CDP client', yargs => {
        yargs.positional('output-dir', {
            describe: 'Output directory to write the client to',
            type: 'string',
            default: ''
        })
    })
    .version('1.0.0')
    .argv);
