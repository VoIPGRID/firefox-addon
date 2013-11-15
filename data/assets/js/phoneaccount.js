/**
 * PhoneAccountViewModal Class
 * @constructor
 */
var PhoneAccountViewModal = function(){
    this.status = ko.observable('');
    this.name = ko.observable('');
    this.extension = ko.observable('');
};

/**
 * PhoneAccount Class
 * @constructor
 */
PhoneAccount = function() {

    this.generateHash = function(){
        return Math.random().toString(36).substring(2);
    }

    this.id = 0;
    this.impi = '';
    this.impu = '';
    this.entity = '';
    this.account_id = 0;
    this.callerid_name = '';
    this.callerid_number = '';
    this.description = '';
    this.internal_number = '';
    this.resource_uri = '';
    this.hash = this.generateHash();

    this.state = 'unavailable';

    this.viewModel = new PhoneAccountViewModal();

    this.updateView = function(){
        this.viewModel.status = ko.observable('status-icon ' + this.state);

        this.viewModel.name = ko.observable(this.description);
        this.viewModel.extension = ko.observable(this.internal_number);
    }
    
    this.update = function(args){
        for(var property in this){
            if(args.hasOwnProperty(property)){
                this[property] = args[property];
            }
        }

        this.updateView();
    }

    this.fromJSON = function(data) {
        this.update(data);

        this.impi = data.account_id.toString();
        this.impu = 'sip:'+ data.account_id + '@' + sipConfig['sip_realm'];

        return this;
    }

    this.renderTo = function(args){
        args.push(ko.observable(this.viewModel));
    }

    this.updateState = function(args){
        this.state = args.state;
        this.updateView();
    }
}
