// Browser fixes:  if these get big, we'll depend on jQuery or the like...
if(!Array.indexOf){
    Array.prototype.indexOf = function(obj){
        for(var i=0; i<this.length; i++){
            if(this[i]==obj){
                return i;
            }
        }
        return -1;
    }
}

fury = {
    // Implicit Invocation
    listeners : {}, fRefCount : 0,
    publish : function ( eventName, data )
    {
        data = data != undefined ? data : {};

        var listeners  = this.listenersFor( eventName );
        for ( var i=0; i<listeners.length; i++ )
        {
            listeners[ i ].targ[ listeners[ i ].fn ].apply( listeners[ i ].targ, [ data ] );
        }
    },
    subscribe : function ( eventName, scope, fn )
    {
        var fName = fn;
        if ( !( typeof( fn ) == "string") ) {
            ++this.fRefCount;
            fName = "fury_listener_ref_" + this.fRefCount;
            // Yeah, that's right, we abuse your object and mixin the ref.
            scope[ fName ] = fn;
        }
        this.listenersFor( eventName ).push( {

                targ : scope,
                fn : fName
            }
        )
    },
    unsubscribe : function ( eventName, scope, fn )
    {
        var listeners  = this.listenersFor( eventName );
        for ( var i = listeners.length - 1; i>=0; i-- ) {
            if ( listeners[i].targ == scope && listeners[i].fn == fn ) {
                listeners.splice( i, 1 );
            }
        }
    },
    listenersFor : function ( eventName )
    {
        return ( this.listeners[ eventName ] = this.listeners[ eventName ] ? this.listeners[ eventName ] : [] );
    },

    // DI
    dependencies : {}, beans : {},
    inject : function ( ref, id, prop, callback )
    {
        var deps = this.dependenciesFor( id );

        deps[ prop ] = deps[ prop ] ? deps[ prop ] : []

        if ( deps[ prop ].indexOf( ref ) == -1 ) {
            deps[ prop ].push( { ref : ref, callback : callback } );
        }

        if ( this.beans[id])
        {
            ref[ prop ] = this.beans[ id ];
            callback ? callback.apply(ref, []) : null;
        }
    },
    register : function ( id, ref )
    {
        if ( !( typeof( id ) == "string") ) {
            for ( var key in id ) {
                this.register( key, id[ key ]);
            }
        }
        else {
            this.beans[ id ] = ref;

            var deps = this.dependenciesFor( id );

            for ( var key in deps )
            {
                for ( var j in deps[key] )
                {
                    this.inject( deps[key][j].ref, id, key, deps[key][j].callback );
                }
            }
        }
    },
    dependenciesFor : function ( id )
    {
        return ( this.dependencies[ id ] = this.dependencies[ id ] ? this.dependencies[ id ] : {} );
    },
    bean  : function( id )
    {
        return this.beans[ id ];
    }
};
