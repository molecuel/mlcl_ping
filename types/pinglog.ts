class pinglogs {
  public deviceid:any;
  public status:string;
  public time:number;
  public ip:string;
  public ipv:number;
  public date:Date;
  constructor() {
    this.date = new Date();
  }
}
export = pinglogs;
