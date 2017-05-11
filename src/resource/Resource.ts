import { LockKind, Lock, LockScope, LockType, LockBag } from './Lock'
import { FSManager, FSPath } from '../manager/FSManager'
import * as path from 'path'
import * as fs from 'fs'

export interface SimpleCallback
{
    (error : Error) : void;
}
export interface ReturnCallback<T>
{
    (error : Error, data : T) : void;
}
export interface Return2Callback<T, Q>
{
    (error : Error, x : T, y : Q) : void;
}

export interface IResource
{
    parent : IResource
    fsManager : FSManager

    //****************************** Actions ******************************//
    create(callback : SimpleCallback)
    delete(callback : SimpleCallback)
    moveTo(to : FSPath, callback : Return2Callback<FSPath, FSPath>)
    rename(newName : string, callback : Return2Callback<string, string>)

    //****************************** Tests ******************************//
    isSame(resource : IResource, callback : ReturnCallback<boolean>)
    isOnTheSameFSWith(resource : IResource, callback : ReturnCallback<boolean>)
    
    //****************************** Content ******************************//
    append(data : Int8Array, callback : SimpleCallback)
    write(data : Int8Array, callback : SimpleCallback)
    read(callback : ReturnCallback<Int8Array>)
    mimeType(callback : ReturnCallback<string>)
    size(callback : ReturnCallback<number>)
    
    //****************************** Locks ******************************//
    getLocks(lockKind : LockKind, callback : ReturnCallback<Array<Lock>>)
    setLock(lock : Lock, callback : SimpleCallback)
    removeLock(uuid : string, owner : string, callback : ReturnCallback<boolean>)
    canLock(lockKind : LockKind, callback : ReturnCallback<boolean>)
    getAvailableLocks(callback : ReturnCallback<Array<LockKind>>)
    canRemoveLock(uuid : string, owner : string, callback : ReturnCallback<boolean>)

    //****************************** Children ******************************//
    addChild(resource : IResource, callback : SimpleCallback)
    removeChild(resource : IResource, callback : SimpleCallback)
    getChildren(callback : ReturnCallback<Array<IResource>>)

    //****************************** Properties ******************************//
    setProperty(name : string, value : string, callback : SimpleCallback)
    getProperty(name : string, callback : ReturnCallback<string>)
    removeProperty(name : string, callback : SimpleCallback)
    
    //****************************** Std meta-data ******************************//
    creationDate(callback : ReturnCallback<number | Date>)
    lastModifiedDate(callback : ReturnCallback<number | Date>)
    webName(callback : ReturnCallback<string>)
}

export abstract class StandardResource implements IResource
{
    properties : Object
    fsManager : FSManager
    lockBag : LockBag
    parent : IResource
    dateCreation : number
    dateLastModified : number
    
    constructor(parent : IResource, fsManager : FSManager)
    {
        this.dateCreation = Date.now();
        this.properties = new Object();
        this.fsManager = fsManager;
        this.lockBag = new LockBag();
        this.parent = parent;
        
        this.dateLastModified = this.dateCreation;
    }

    protected updateLastModified()
    {
        this.dateLastModified = Date.now();
    }

    protected removeFromParent(callback : SimpleCallback)
    {
        if(this.parent)
            this.parent.removeChild(this, callback);
        else
            callback(null);
    }

    //****************************** Tests ******************************//
    isSame(resource : IResource, callback : ReturnCallback<boolean>)
    {
        callback(null, resource === (this as Object));
    }
    isOnTheSameFSWith(resource : IResource, callback : ReturnCallback<boolean>)
    {
        callback(null, resource.fsManager === this.fsManager);
    }

    //****************************** Locks ******************************//
    getAvailableLocks(callback : ReturnCallback<Array<LockKind>>)
    {
        callback(null, [
            new LockKind(LockScope.Esclusive, LockType.Write),
            new LockKind(LockScope.Shared, LockType.Write)
        ])
    }
    getLocks(lockKind : LockKind, callback : ReturnCallback<Array<Lock>>)
    {
        callback(null, this.lockBag.getLocks(lockKind));
    }
    setLock(lock : Lock, callback : SimpleCallback)
    {
        var locked = this.lockBag.setLock(lock);
        callback(locked ? null : new Error('Can\'t lock the resource.'));
    }
    removeLock(uuid : string, owner : string, callback : ReturnCallback<boolean>)
    {
        this.getChildren((e, children) => {
            if(e)
            {
                callback(e, false);
                return;
            }

            var nb = children.length + 1;
            children.forEach(child => {
                child.canRemoveLock(uuid, owner, go);
            });
            go(null, true);

            function go(e, can)
            {
                if(e)
                {
                    nb = -1;
                    callback(e, false);
                    return;
                }
                if(!can)
                {
                    nb = -1;
                    callback(null, false);
                    return;
                }
                --nb;
                if(nb === 0)
                {
                    this.lockBag.removeLock(uuid, owner);
                    this.updateLastModified();
                    callback(null, true);
                }
            }
        })
    }
    canRemoveLock(uuid : string, owner : string, callback : ReturnCallback<boolean>)
    {
        callback(null, this.lockBag.canRemoveLock(uuid, owner));
    }
    canLock(lockKind : LockKind, callback : ReturnCallback<boolean>)
    {
        callback(null, this.lockBag.canLock(lockKind));
    }
    
    //****************************** Properties ******************************//
    setProperty(name : string, value : string, callback : SimpleCallback)
    {
        this.properties[name] = value;
        this.updateLastModified();
        callback(null);
    }
    getProperty(name : string, callback : ReturnCallback<string>)
    {
        var value = this.properties[name];
        if(value === undefined)
            callback(new Error('No property with such name.'), null);
        else
            callback(null, value);
    }
    removeProperty(name : string, callback : SimpleCallback)
    {
        delete this.properties[name];
        this.updateLastModified();
        callback(null);
    }
    
    //****************************** Actions ******************************//
    abstract create(callback : SimpleCallback)
    abstract delete(callback : SimpleCallback)
    abstract moveTo(to : FSPath, callback : Return2Callback<FSPath, FSPath>)
    abstract rename(newName : string, callback : Return2Callback<string, string>)

    //****************************** Content ******************************//
    abstract append(data : Int8Array, callback : SimpleCallback)
    abstract write(data : Int8Array, callback : SimpleCallback)
    abstract read(callback : ReturnCallback<Int8Array>)
    abstract mimeType(callback : ReturnCallback<string>)
    abstract size(callback : ReturnCallback<number>)
    
    //****************************** Std meta-data ******************************//
    creationDate(callback : ReturnCallback<number | Date>)
    {
        callback(null, this.dateCreation);
    }
    lastModifiedDate(callback : ReturnCallback<number | Date>)
    {
        callback(null, this.dateLastModified);
    }
    abstract webName(callback : ReturnCallback<string>)
    
    //****************************** Children ******************************//
    abstract addChild(resource : IResource, callback : SimpleCallback)
    abstract removeChild(resource : IResource, callback : SimpleCallback)
    abstract getChildren(callback : ReturnCallback<Array<IResource>>)
}
